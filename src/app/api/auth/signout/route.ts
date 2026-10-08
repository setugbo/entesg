import { signOut } from "@/server/actions";
export async function POST() {
  await signOut();
}
