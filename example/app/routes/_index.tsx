import type { V2_MetaFunction } from "@remix-run/node";

export const meta: V2_MetaFunction = () => {
  return [{ title: "New Remix App" }];
};

export default function Index() {
  return `this is in the \`/routes\` directory so it doesn't need the \`.route\` suffix`;
}
