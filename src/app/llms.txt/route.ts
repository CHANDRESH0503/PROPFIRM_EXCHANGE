import { brand } from "@/config/brand";
import { publicEnv } from "@/lib/public-env";
import { CALCULATORS } from "@/lib/tools/calculators";

/** llms.txt: a plain summary of the site and its main pages for AI crawlers. */

export function GET() {
  const url = (p: string) => new URL(p, publicEnv.siteUrl).toString();
  const body = [
    `# ${brand.name}`,
    "",
    `> ${brand.name} lists prop-firm challenges at their real lowest price, returns most of its affiliate commission to traders as Coins, and offers free trader tools and a trading journal. Prop-firm challenges are simulated evaluations; most traders do not pass. ${brand.name} earns a commission on purchases. Nothing on the site is investment advice. Coins have no cash value.`,
    "",
    "## Main pages",
    `- [Firm directory](${url("/firms")}): prop firms and programs with list prices and rules`,
    `- [Deals](${url("/deals")}): current discount codes and net prices`,
    `- [How rewards work](${url("/how-rewards-work")}): how Coins are earned, held and redeemed`,
    `- [How we make money](${url("/how-we-make-money")}): affiliate commissions and give-back`,
    `- [Trading journal](${url("/journal")}): free private journal for prop traders`,
    `- [Help centre](${url("/help")})`,
    "",
    "## Tools",
    ...CALCULATORS.map((k) => `- [${k.replace(/-/g, " ")}](${url(`/tools/${k}`)})`),
    `- [Market sessions clock](${url("/tools/market-sessions")})`,
    `- [Economic calendar](${url("/economic-calendar")})`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
