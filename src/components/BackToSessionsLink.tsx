import Link from "next/link";

export default function BackToSessionsLink() {
  return (
    <Link href="/?list=1" className="text-sm text-sky-600 hover:underline">
      ‹ All Sessions
    </Link>
  );
}
