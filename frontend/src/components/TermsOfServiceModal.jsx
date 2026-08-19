import React from 'react';

export const TOS_RULES = [
  {
    category: "1. Account Eligibility & Security",
    rules: [
      "You must be at least 13 years old (or the minimum legal age in your jurisdiction) to create an account.",
      "You are solely responsible for maintaining the confidentiality of your login credentials, passwords, and security tokens.",
      "Account sharing, selling, trading, or transferring ownership of accounts without explicit administrator approval is strictly prohibited.",
      "Any suspicious activity originating from your account will be treated as authorized by you unless reported immediately."
    ]
  },
  {
    category: "2. Prohibited Conduct & Community Guidelines",
    rules: [
      "Zero tolerance for harassment, hate speech, bullying, stalking, dox threats, or discrimination based on race, gender, religion, or nationality.",
      "No distribution of illegal content, malware, spyware, phishing links, keyloggers, or unauthorized exploits.",
      "No spamming, message flooding, repetitive character clutter, or bypassing chat rate limits.",
      "No impersonation of Wired administrators, staff, community moderators, or other verified public figures.",
      "No advertising, self-promotion, pyramid schemes, or unsolicited commercial messaging in public server channels without channel owner permission."
    ]
  },
  {
    category: "3. Minecraft & Gaming Integration Conduct",
    rules: [
      "No hacking, cheat clients, X-ray texture packs, automated botting, fly hacks, or unapproved combat modifications.",
      "No griefing, unauthorized structure destruction, chunk overloading, lag machine construction, or game economy duping.",
      "Respect all designated server borders (+/- 5,000 blocks) and claim protections.",
      "In-game broadcasts, screen alerts, and global chat relayed through Wired-IO are subject to immediate moderation review.",
      "Violations of in-game rules will result in coordinated bans across both the Minecraft server and the Wired-IO platform."
    ]
  },
  {
    category: "4. Content Ownership & Moderation",
    rules: [
      "You retain ownership of original text and messages you submit, but grant Wired-IO a non-exclusive license to host, display, and process your content.",
      "Automated and manual content filters are deployed across all channels; attempts to evade banned word filters using obfuscation or unicode trickery will result in progressive discipline.",
      "Wired-IO staff reserve the unilateral right to delete content, mute channels, revoke server roles, or permanently terminate accounts that violate these terms.",
      "Appeals for bans or account terminations must be filed through the official support ticket portal."
    ]
  },
  {
    category: "5. Platform Integrity, Rate Limits & Exploits",
    rules: [
      "Do not perform DDoS attacks, stress tests, port scanning, or malicious vulnerability probing against Wired-IO infrastructure.",
      "Do not reverse-engineer, decompile, or attempt to manipulate platform tokens, WebSocket payloads, or API endpoints.",
      "Bypassing timeout restrictions, IP bans, or shadowbanning mechanisms using disposable proxies or alternate accounts is strictly forbidden.",
      "Users who discover security vulnerabilities are required to responsibly disclose them to administrators rather than exploiting them."
    ]
  },
  {
    category: "6. Limitation of Liability & Service Availability",
    rules: [
      "Wired-IO services, games, chat, and features are provided on an 'AS IS' and 'AS AVAILABLE' basis without warranties of any kind.",
      "We are not liable for accidental data loss, third-party network outages, server maintenance downtime, or lost in-game assets.",
      "Terms of Service may be updated periodically; continued usage of Wired-IO following changes constitutes binding acceptance of the new terms."
    ]
  }
];

export default function TermsOfServiceModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'linear-gradient(145deg, #11141c 0%, #0a0c10 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          maxWidth: '720px',
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 40px rgba(99, 102, 241, 0.15)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div>
            <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              📜 Wired-IO Terms of Service & Rules
            </h2>
            <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
              Last Revised: August 2026 • Effective immediately across all platforms & game servers
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: '8px',
              color: '#94a3b8',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              transition: 'all 0.15s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.color = '#94a3b8'; }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          color: '#cbd5e1',
          fontSize: '0.92rem',
          lineHeight: '1.6',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '10px',
            padding: '14px 16px',
            color: '#c7d2fe',
            fontSize: '0.88rem'
          }}>
            ⚠️ By registering an account, chatting on Wired-IO, or playing on connected Minecraft servers, you agree to comply strictly with all provisions detailed below. Failure to comply may lead to immediate muting, IP ban, and account termination.
          </div>

          {TOS_RULES.map((section, idx) => (
            <div key={idx} style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              padding: '16px 18px'
            }}>
              <h3 style={{
                margin: '0 0 12px 0',
                color: '#60a5fa',
                fontSize: '1rem',
                fontWeight: 600
              }}>
                {section.category}
              </h3>
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {section.rules.map((rule, rIdx) => (
                  <li key={rIdx} style={{ color: '#e2e8f0' }}>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'flex-end',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <button 
            onClick={onClose}
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)'; }}
          >
            I Understand & Agree
          </button>
        </div>
      </div>
    </div>
  );
}
