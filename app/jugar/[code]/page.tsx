"use client";
import { useParams } from "next/navigation";
import Arena from "@/lib/arena";
export default function Play() {
  const { code } = useParams<{ code: string }>();
  return <Arena code={code} />;
}
