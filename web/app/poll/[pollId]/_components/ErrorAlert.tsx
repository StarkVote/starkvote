type ErrorAlertProps = {
  message: string;
};

export function ErrorAlert({ message }: ErrorAlertProps) {
  return (
    <section className="rounded-2xl border border-red-400/40 bg-red-950/50 p-4 text-sm text-red-200">
      {message}
    </section>
  );
}
