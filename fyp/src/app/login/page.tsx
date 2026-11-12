import { getAuthUser } from "@/auth/server/action";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Login() {
    const user = await getAuthUser();

    if (user) {
        return <div>Logged in as {user.email}</div>;
    }

    return <Link href={"/api/oauth/google"}>Google oauth kdmv</Link>;
}
