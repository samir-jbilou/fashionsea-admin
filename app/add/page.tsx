import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import AddItemForm from "./AddItemForm";

export default async function AddPage() {
  const authed = await isAuthenticated();
  if (!authed) {
    redirect("/login?next=%2Fadd");
  }
  return <AddItemForm />;
}
