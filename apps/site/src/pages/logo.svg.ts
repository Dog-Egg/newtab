import logo from "../../../../assets/logo.svg?raw";

export const prerender = true;

export function GET() {
  return new Response(logo, {
    headers: {
      "Content-Type": "image/svg+xml",
    },
  });
}
