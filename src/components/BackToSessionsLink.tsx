import Link from "next/link";

export default function BackToSessionsLink() {
  return (
    <Link href="/" className="text-sm text-blue-600 hover:underline">
      ← All Sessions
    </Link>
  );
}
