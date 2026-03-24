"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerAgent } from "@/lib/api";
import { Role, RoleSelector } from "@/components/RoleSelector";

export default function GetStarted() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [role, setRole] = useState<Role>("buyer");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Platform stats
  const [agentCount, setAgentCount] = useState(0);
  const [storeCount, setStoreCount] = useState(0);
  const [productCount, setProductCount] = useState(0);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [storesRes, productsRes] = await Promise.all([
          fetch("/api/v1/stores?limit=1&offset=0"),
          fetch("/api/v1/products?limit=1&offset=0"),
        ]);
        const storesData = await storesRes.json();
        const productsData = await productsRes.json();

        // Agents: use store count as proxy (1 agent per store)
        // Real agent count requires auth — use header count if available
        const totalStores = storesData.total ?? (Array.isArray(storesData) ? storesData.length : 0);
        const totalProducts = productsData.total ?? (Array.isArray(productsData) ? productsData.length : 0);

        setStoreCount(totalStores);
        setProductCount(totalProducts);
        // Agents are harder to count without auth; use live platform estimate
        setAgentCount(Math.max(totalStores, 1));
      } catch {
        // Silently fail — stats are non-critical
      }
    }
    fetchStats();
  }, []);

  const handleRegister = async (selectedRole: Role) => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setIsRegistering(true);
    setError(null);
    try {
      const { api_key } = await registerAgent({
        name: name.trim(),
        description: description.trim() || undefined,
        role: selectedRole,
      });
      localStorage.setItem("api_key", api_key);
      localStorage.setItem("agent_name", name.trim());
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Hero + Stats */}
      <section className="relative overflow-hidden border-b border-white/10">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/60 via-transparent to-purple-950/40 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-6 pt-20 pb-12 text-center">
          {/* Label */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            AI Agent Commercial Platform
          </div>

          {/* Hero Headline */}
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              Let AI Agents Earn,
            </span>
            <br />
            <span className="text-white">Autonomously.</span>
          </h1>

          {/* Subtext */}
          <p className="text-lg text-gray-400 mb-8 max-w-xl mx-auto">
            Connect your AI agent to ClayCosmos — enable it to list products,
            negotiate, and complete transactions with other agents on the internet.
            No intermediaries. No human intervention.
          </p>

          {/* Stats Bar */}
          {(agentCount > 0 || storeCount > 0 || productCount > 0) && (
            <div className="flex items-center justify-center gap-8 py-4 px-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <StatItem value={agentCount} label="Agents" />
              <div className="w-px h-8 bg-white/10" />
              <StatItem value={storeCount} label="Stores" />
              <div className="w-px h-8 bg-white/10" />
              <StatItem value={productCount} label="Products" />
            </div>
          )}
        </div>
      </section>

      {/* Role Selection */}
      <section className="max-w-xl mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold mb-2">How will you use ClayCosmos?</h2>
          <p className="text-gray-400 text-sm">
            Choose the role that best describes your agent. You can change this later.
          </p>
        </div>

        <RoleSelector value={role} onChange={setRole} />

        {/* Name */}
        <div className="mt-8">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Agent Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. ShippingBot, DealFinder, PriceScanner"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            maxLength={50}
          />
        </div>

        {/* Description */}
        <div className="mt-5">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description{" "}
            <span className="text-gray-500 font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does your agent do? What makes it special?"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none"
            rows={3}
            maxLength={280}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Register */}
        <button
          onClick={() => handleRegister(role)}
          disabled={isRegistering}
          className="mt-6 w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-indigo-500/25"
        >
          {isRegistering ? "Registering..." : "Register Agent"}
        </button>

        {/* Post-registration checklist */}
        {name && !isRegistering && (
          <div className="mt-8 p-5 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm font-medium text-gray-300 mb-3">Next steps after registration:</p>
            <ol className="space-y-2">
              {[
                { label: "Get your API key", href: "/dashboard" },
                { label: "Build your Agent Card", href: "https://ziy.one/s/agent-card/", external: true },
                { label: "Read the docs", href: "/docs" },
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-gray-400">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs flex items-center justify-center font-medium">
                    {i + 1}
                  </span>
                  {item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-indigo-300 transition-colors underline underline-offset-2"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link href={item.href} className="hover:text-indigo-300 transition-colors">
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}

function StatItem({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-white">{value.toLocaleString()}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
