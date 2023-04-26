import { useLoaderData } from "@remix-run/react";
import { notARoute } from "./not-a-route";

export function loader() {
  return {
    data: { nested: "sup" },
    hello: "world",
    // data: "sheeeeesh"
  };
}

export default function () {
  let data = useLoaderData<typeof loader>();
  return notARoute() + "sheeeeesh";
}
