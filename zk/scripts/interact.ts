#!/usr/bin/env tsx
// Contract interaction script for StarkVote
// Provides CLI commands for testing the full voting workflow

import { Account, Contract, RpcProvider, cairo } from 'starknet';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// Contract ABIs (to be filled in)
const REGISTRY_ABI = [];
const POLL_ABI = [];
const VERIFIER_ABI = [];

// Contract addresses (from deployment)
const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS || '';
const POLL_ADDRESS = process.env.POLL_ADDRESS || '';
const VERIFIER_ADDRESS = process.env.VERIFIER_ADDRESS || '';

// RPC and account setup
const RPC_URL = process.env.RPC_URL || 'https://starknet-sepolia.public.blastapi.io';
const provider = new RpcProvider({ nodeUrl: RPC_URL });

// Ensure addresses have 0x prefix
const adminAddr = (process.env.ADMIN_ADDRESS || '').startsWith('0x')
  ? process.env.ADMIN_ADDRESS!
  : `0x${process.env.ADMIN_ADDRESS}`;
const privateKey = (process.env.PRIVATE_KEY || '').startsWith('0x')
  ? process.env.PRIVATE_KEY!
  : `0x${process.env.PRIVATE_KEY}`;

const account = new Account({
  provider: provider,
  address: adminAddr,
  signer: privateKey
});

// Registry functions
export async function addVoter(commitment: string) {
    console.log(`Adding voter with commitment: ${commitment}`);
    const registry = new Contract(REGISTRY_ABI, REGISTRY_ADDRESS, account);
    const tx = await registry.add_voter(cairo.uint256(commitment));
    await provider.waitForTransaction(tx.transaction_hash);
    console.log(`✓ Voter added. Tx: ${tx.transaction_hash}`);
}

export async function addVoters(commitments: string[]) {
    console.log(`Adding ${commitments.length} voters...`);
    for (const commitment of commitments) {
        await addVoter(commitment);
    }
}

export async function freezeRegistry() {
    console.log('Freezing registry...');
    const registry = new Contract(REGISTRY_ABI, REGISTRY_ADDRESS, account);
    const tx = await registry.freeze();
    await provider.waitForTransaction(tx.transaction_hash);
    console.log(`✓ Registry frozen. Tx: ${tx.transaction_hash}`);
}

export async function getLeafCount(): Promise<number> {
    const registry = new Contract(REGISTRY_ABI, REGISTRY_ADDRESS, provider);
    const count = await registry.get_leaf_count();
    return Number(count);
}

// Poll functions
export async function createPoll(
    pollId: number,
    optionsCount: number,
    startTime: number,
    endTime: number,
    root: string
) {
    console.log(`Creating poll ${pollId} with root ${root}...`);
    const poll = new Contract(POLL_ABI, POLL_ADDRESS, account);

    const tx = await poll.create_poll(
        cairo.uint64(pollId),
        cairo.uint8(optionsCount),
        cairo.uint64(startTime),
        cairo.uint64(endTime),
        cairo.uint256(root)
    );

    await provider.waitForTransaction(tx.transaction_hash);
    console.log(`✓ Poll created. Tx: ${tx.transaction_hash}`);
}

export async function submitVote(calldataPath: string) {
    console.log(`Submitting vote from ${calldataPath}...`);
    const calldata = JSON.parse(fs.readFileSync(calldataPath, 'utf-8'));

    const poll = new Contract(POLL_ABI, POLL_ADDRESS, account);

    // TODO: Format proof components correctly
    const tx = await poll.vote(
        cairo.uint64(calldata.poll_id),
        cairo.uint8(calldata.option),
        [cairo.uint256(calldata.p_a.x), cairo.uint256(calldata.p_a.y)],
        [
            [cairo.uint256(calldata.p_b.x[0]), cairo.uint256(calldata.p_b.x[1])],
            [cairo.uint256(calldata.p_b.y[0]), cairo.uint256(calldata.p_b.y[1])]
        ],
        [cairo.uint256(calldata.p_c.x), cairo.uint256(calldata.p_c.y)],
        calldata.public_signals.map((s: string) => cairo.uint256(s))
    );

    await provider.waitForTransaction(tx.transaction_hash);
    console.log(`✓ Vote submitted. Tx: ${tx.transaction_hash}`);
}

export async function getTally(pollId: number, option: number): Promise<number> {
    const poll = new Contract(POLL_ABI, POLL_ADDRESS, provider);
    const tally = await poll.get_tally(cairo.uint64(pollId), cairo.uint8(option));
    return Number(tally);
}

export async function finalizePoll(pollId: number) {
    console.log(`Finalizing poll ${pollId}...`);
    const poll = new Contract(POLL_ABI, POLL_ADDRESS, account);
    const tx = await poll.finalize(cairo.uint64(pollId));
    await provider.waitForTransaction(tx.transaction_hash);
    console.log(`✓ Poll finalized. Tx: ${tx.transaction_hash}`);
}

export async function getPollInfo(pollId: number) {
    const poll = new Contract(POLL_ABI, POLL_ADDRESS, provider);
    const info = await poll.get_poll(cairo.uint64(pollId));
    return info;
}

// CLI entry point
async function main() {
    const command = process.argv[2];

    switch (command) {
        case 'add-voters':
            const commitments = process.argv.slice(3);
            await addVoters(commitments);
            break;

        case 'freeze-registry':
            await freezeRegistry();
            break;

        case 'create-poll':
            const pollId = parseInt(process.argv[3]);
            const optionsCount = parseInt(process.argv[4]);
            const startTime = parseInt(process.argv[5]);
            const endTime = parseInt(process.argv[6]);
            const root = process.argv[7];
            await createPoll(pollId, optionsCount, startTime, endTime, root);
            break;

        case 'submit-vote':
            const calldataPath = process.argv[3];
            await submitVote(calldataPath);
            break;

        case 'get-tally':
            const tallyPollId = parseInt(process.argv[3]);
            const option = parseInt(process.argv[4]);
            const tally = await getTally(tallyPollId, option);
            console.log(`Poll ${tallyPollId}, Option ${option}: ${tally} votes`);
            break;

        case 'finalize':
            const finalizePollId = parseInt(process.argv[3]);
            await finalizePoll(finalizePollId);
            break;

        case 'get-poll':
            const getPollId = parseInt(process.argv[3]);
            const info = await getPollInfo(getPollId);
            console.log('Poll info:', info);
            break;

        default:
            console.log(`
StarkVote Interaction CLI

Usage:
  interact.ts add-voters <commitment1> <commitment2> ...
  interact.ts freeze-registry
  interact.ts create-poll <pollId> <optionsCount> <startTime> <endTime> <root>
  interact.ts submit-vote <calldataPath>
  interact.ts get-tally <pollId> <option>
  interact.ts finalize <pollId>
  interact.ts get-poll <pollId>

Environment variables:
  RPC_URL - Starknet RPC endpoint
  ADMIN_ADDRESS - Admin account address
  PRIVATE_KEY - Admin private key
  REGISTRY_ADDRESS - VoterSetRegistry contract address
  POLL_ADDRESS - Poll contract address
  VERIFIER_ADDRESS - Verifier contract address
            `);
    }
}

if (require.main === module) {
    main().catch(console.error);
}
