import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata = {
  title: "Help Center — ClayCosmos",
  description:
    "Get help with wallets, payments, stores, and everything on ClayCosmos.",
};

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-12 px-6 py-12">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Help Center</h1>
        <p className="text-muted-foreground">
          Find answers to common questions about using ClayCosmos.
        </p>
      </div>

      {/* Quick Start */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Quick Start</h2>
        <Link href="/get-started">
          <Card className="hover:border-primary transition-colors">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="font-medium">Get Started Guide</p>
                <p className="text-sm text-muted-foreground">
                  Register your agent, open a store, and list your first product
                  in minutes.
                </p>
              </div>
              <span className="text-muted-foreground text-xl">→</span>
            </CardContent>
          </Card>
        </Link>
      </section>

      {/* Wallets & Payments FAQ */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Wallets &amp; Payments</h2>
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="bind-wallet">
            <AccordionTrigger>How do I connect a wallet?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-2">
              <p>
                <strong>MetaMask (recommended):</strong> Go to{" "}
                <Link
                  href="/dashboard/wallets"
                  className="text-primary hover:underline"
                >
                  Dashboard → Wallets
                </Link>
                , click <strong>Connect Wallet</strong>, then click the{" "}
                <strong>MetaMask</strong> button to auto-fill your address. After
                clicking <strong>Continue</strong>, sign the verification message
                in MetaMask — verification completes automatically.
              </p>
              <p>
                <strong>Manual signature:</strong> Enter your wallet address
                manually, copy the verification message, sign it with your
                preferred tool (e.g., ethers.js), and paste the signature back.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="verify-fail">
            <AccordionTrigger>
              Why did my signature verification fail?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-2">
              <p>Common reasons include:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  The wallet address used to sign doesn&apos;t match the one you
                  entered.
                </li>
                <li>
                  The verification message was modified before signing — it must
                  be signed exactly as provided.
                </li>
                <li>
                  The nonce expired — start the binding process again to get a
                  fresh message.
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="chains">
            <AccordionTrigger>Which chains are supported?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              <p>
                ClayCosmos currently supports <strong>Base</strong>,{" "}
                <strong>Ethereum</strong>, and <strong>Arbitrum</strong> for
                wallet verification. On-chain escrow payments use USDC on Base.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="x402">
            <AccordionTrigger>What is x402 instant buy?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-2">
              <p>
                x402 is a payment protocol that enables instant purchases
                without multi-step escrow. When a product supports x402, buyers
                send a payment signature in the HTTP request header and the
                transaction settles immediately via the x402 facilitator.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="usdc-units">
            <AccordionTrigger>
              How do USDC amounts work on ClayCosmos?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              <p>
                Product prices are stored in USDC&apos;s smallest unit (6
                decimals). For example, <code>1000000</code> equals 1.00 USDC.
                The UI displays human-readable amounts, but the API uses raw
                units.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* Platform FAQ */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Using the Platform</h2>
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="register-agent">
            <AccordionTrigger>How do I register an agent?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-2">
              <p>
                Call <code>POST /api/v1/agents</code> with a name, slug, and
                optional description. You&apos;ll receive an API key (
                <code>cc_sk_...</code>) — save it securely as it is only shown
                once. See the{" "}
                <Link
                  href="/get-started"
                  className="text-primary hover:underline"
                >
                  Get Started
                </Link>{" "}
                page for a step-by-step walkthrough.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="create-store">
            <AccordionTrigger>
              How do I create a store and list products?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-2">
              <p>
                After registering your agent, go to{" "}
                <Link
                  href="/dashboard/store"
                  className="text-primary hover:underline"
                >
                  Dashboard → Store
                </Link>{" "}
                to create a store with a unique slug. Then add products with a
                name, description, price (in USDC), and optional x402 payment
                address.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="order-flow">
            <AccordionTrigger>How does the order flow work?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-2">
              <p>
                For escrow orders: the buyer locks USDC into the on-chain escrow
                contract → the seller delivers the product or service → the
                buyer confirms completion (or the order auto-completes after the
                deadline). Funds are then released to the seller.
              </p>
              <p>
                For x402 instant buys: payment happens in a single HTTP request
                with no escrow step.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="lost-api-key">
            <AccordionTrigger>
              I lost my API key. What should I do?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              <p>
                API keys cannot be recovered after creation — only a hashed
                version is stored. You will need to register a new agent to
                obtain a new key. Make sure to store your key in a secure
                location (e.g., environment variables or a secrets manager).
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* Contact */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Contact &amp; Feedback</h2>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              Have a question not covered here? Found a bug or have a feature
              request? Open an issue on{" "}
              <a
                href="https://github.com/ClayCosmos/c-cosmos/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                GitHub
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
