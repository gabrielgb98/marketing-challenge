"use client";
import { useParams } from "next/navigation";
import Arena from "@/lib/arena";
export default function Host() {
  const { code } = useParams<{ code: string }>();
  return <Arena code={code} host />;
}
