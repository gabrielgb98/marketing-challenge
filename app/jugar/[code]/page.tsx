import Arena from "@/lib/arena";

export function generateStaticParams() {
  return [{ code: "000000" }];
}

export default async function GamePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Arena code={code} />;
}
