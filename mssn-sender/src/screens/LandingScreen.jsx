import { useState, useEffect, useRef } from 'react'

function AnimatedNumber({ target, suffix = '' }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const steps = 60
        const duration = 1800
        let step = 0
        const timer = setInterval(() => {
          step++
          setDisplay(Math.round((target / steps) * step))
          if (step >= steps) { setDisplay(target); clearInterval(timer) }
        }, duration / steps)
      }
    }, { threshold: 0.5 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])

  const formatted = display >= 1000 ? display.toLocaleString() : display
  return <div ref={ref} style={{ fontSize: 52, fontWeight: 700, letterSpacing: '-2px', lineHeight: 1 }}>{formatted}{suffix}</div>
}

function CheckIcon({ pro = false }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="6" fill={pro ? '#1a3a1a' : '#f0fdf4'} />
      <path d="M4 7l2 2 4-4" stroke={pro ? '#25D366' : '#166534'} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

const features = [
  {
    title: 'Paste and send instantly',
    body: 'Drop numbers in any format. BulkIt auto-formats to international standard and sends within seconds.',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M18 2L8 12M18 2L12 18L8 12M18 2L2 8L8 12" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  },
  {
    title: 'CSV bulk upload',
    body: 'Upload your member list with names, phones, and groups. Send to all or filter by subgroup.',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="3" stroke="#0a0a0a" strokeWidth="1.5" /><path d="M2 8h16M2 13h16M8 2v16" stroke="#0a0a0a" strokeWidth="1.5" /></svg>
  },
  {
    title: 'Name personalization',
    body: 'Use {{name}} to address every member individually. Every message feels personal, never a mass blast.',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="4" stroke="#0a0a0a" strokeWidth="1.5" /><path d="M3 18c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round" /></svg>
  },
  {
    title: 'Anti-ban protection',
    body: 'Smart delays between every message protect your account. Automatic pause every 50 sends.',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2L3 5.5v5c0 4 2.8 7.7 7 8.5 4.2-.8 7-4.5 7-8.5v-5L10 2z" stroke="#0a0a0a" strokeWidth="1.5" strokeLinejoin="round" /><path d="M7 10l2 2 4-4" stroke="#25D366" strokeWidth="1.5" strokeLinecap="round" /></svg>
  },
  {
    title: 'Live delivery tracking',
    body: 'Watch sends happen in real time. Full per-recipient report showing delivered, failed, and reasons.',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 17V9M8 17V4M13 17V11M18 17V2" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round" /></svg>
  },
  {
    title: 'Your own number',
    body: 'Connect any WhatsApp number by QR scan. Recipients see your real number, not a random shortcode.',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M14.5 13c-.8.8-.8 1.7-1.7 1.7-2.2 0-5.8-3.6-7.6-7.6 0-.9.9-.9 1.7-1.7L8.5 3c.4-.5.4-1.4 0-1.9L6.7.2C6.2-.2 5.3-.2 4.8.2 2.5 2.5 1 4.7 1 7.7c0 5.8 4.9 10.8 10.8 10.8 3 0 5.2-1.5 7.5-3.8.5-.5.5-1.4 0-1.9l-1.9-1.9c-.5-.4-1.4-.4-1.9 0L14.5 13z" stroke="#0a0a0a" strokeWidth="1.5" strokeLinejoin="round" fill="none" /></svg>
  }
]

const orgs = ['MSSN Unilag', 'Student Unions', 'Campus Mosques', 'NGOs', 'Business Associations', 'MSSN Lagos', 'Youth Organizations', 'Faith Communities', 'Alumni Networks', 'Professional Bodies']

export default function LandingScreen({ onNavigate }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const goLogin    = () => onNavigate('login', { tab: 'login' })
  const goRegister = () => onNavigate('login', { tab: 'register' })

  async function handleSignIn() {
    const token = localStorage.getItem('mssn_token')
    if (!token) { onNavigate('login', { tab: 'login' }); return }
    // Returning user — auto login silently
    try {
      const res = await fetch('https://api.zaicondigital.com/api/instance/mine', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.status === 401) { localStorage.clear(); onNavigate('login', { tab: 'login' }); return }
      const data = await res.json()
      if (data && data.instance_name) {
        localStorage.setItem('mssn_instance', data.instance_name)
        onNavigate('dashboard')
      } else {
        onNavigate('setup')
      }
    } catch {
      onNavigate('login', { tab: 'login' })
    }
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#fff', color: '#0a0a0a', overflowX: 'hidden' }}>

      {/* NAVBAR */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', borderBottom: '0.5px solid #e8e8e4', padding: '0 48px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/images/bulkit-logo-removebg-preview.png" width="32" height="32" alt="BulkIt" style={{ borderRadius: 8 }} />
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px' }}>BulkIt</span>
        </div>

        <div className="lp-nav-links" style={{ display: 'flex', gap: 32 }}>
          {[['#features','Features'],['#how-it-works','How it works'],['#pricing','Pricing']].map(([href, label]) => (
            <a key={href} href={href} style={{ fontSize: 14, color: '#555', textDecoration: 'none', fontWeight: 500 }}>{label}</a>
          ))}
        </div>

        <div className="lp-nav-actions" style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleSignIn} style={{ fontSize: 14, fontWeight: 500, cursor: 'pointer', padding: '8px 16px', borderRadius: 8, border: '0.5px solid #d0d0cc', background: 'transparent', color: '#0a0a0a' }}>Sign in</button>
          <button onClick={goRegister} style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '8px 18px', borderRadius: 8, background: '#0a0a0a', color: '#fff', border: 'none' }}>Get started free</button>
        </div>

        <button className="lp-hamburger" onClick={() => setMenuOpen(o => !o)} style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 6h16M3 11h16M3 16h16" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      </nav>

      {menuOpen && (
        <div style={{ background: '#fff', borderBottom: '0.5px solid #e8e8e4', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[['#features','Features'],['#how-it-works','How it works'],['#pricing','Pricing']].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)} style={{ fontSize: 15, color: '#0a0a0a', textDecoration: 'none', fontWeight: 500 }}>{label}</a>
          ))}
          <button onClick={handleSignIn} style={{ fontSize: 14, fontWeight: 500, padding: '10px', borderRadius: 8, border: '0.5px solid #d0d0cc', background: 'transparent', cursor: 'pointer' }}>Sign in</button>
          <button onClick={goRegister} style={{ fontSize: 14, fontWeight: 600, padding: '10px', borderRadius: 8, background: '#0a0a0a', color: '#fff', border: 'none', cursor: 'pointer' }}>Get started free</button>
        </div>
      )}

      {/* HERO */}
      <section style={{ paddingTop: 120, paddingBottom: 80, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '120px 24px 80px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '0.5px solid #86efac', borderRadius: 999, padding: '6px 14px', marginBottom: 32 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#25D366', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#166534', fontWeight: 500 }}>Now live. Send to 2,000+ members</span>
        </div>

        <h1 style={{ fontSize: 'clamp(40px, 6vw, 68px)', fontWeight: 700, letterSpacing: '-2px', lineHeight: 1.06, maxWidth: 800, margin: '0 0 24px' }}>
          WhatsApp outreach,<br />done <span style={{ color: '#25D366' }}>properly.</span>
        </h1>

        <p style={{ fontSize: 18, color: '#666', maxWidth: 520, lineHeight: 1.65, margin: '0 0 40px' }}>
          BulkIt lets organizations send personal WhatsApp messages to every member. No broadcast limits. No group chat noise.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 14 }}>
          <button onClick={goRegister} style={{ fontSize: 15, fontWeight: 600, color: '#fff', padding: '13px 28px', borderRadius: 10, background: '#0a0a0a', border: 'none', cursor: 'pointer' }}>
            Start sending free
          </button>
          <a href="#how-it-works" style={{ fontSize: 15, fontWeight: 600, color: '#0a0a0a', padding: '13px 28px', borderRadius: 10, background: '#fff', border: '0.5px solid #d0d0cc', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            See how it works
          </a>
        </div>
        <p style={{ fontSize: 13, color: '#999', marginBottom: 64 }}>No credit card required. Connect in 30 seconds.</p>

        <img src="/images/tinywow_hero-mockup_89425990.png" alt="BulkIt dashboard" style={{ width: '100%', maxWidth: 960, display: 'block', margin: '0 auto', borderRadius: 20 }} />
      </section>

      {/* MARQUEE */}
      <div style={{ background: '#fafaf8', borderTop: '0.5px solid #e8e8e4', borderBottom: '0.5px solid #e8e8e4', padding: '16px 0', overflow: 'hidden' }}>
        <p style={{ fontSize: 13, color: '#999', textAlign: 'center', marginBottom: 12 }}>Trusted by organizations including</p>
        <div style={{ overflow: 'hidden' }}>
          <div className="lp-marquee">
            {[...Array(3)].map((_, gi) => (
              <div key={gi} style={{ display: 'flex', gap: 10, paddingRight: 10, flexShrink: 0 }}>
                {orgs.map(name => (
                  <span key={name} style={{ fontSize: 13, fontWeight: 500, color: '#555', background: '#efefec', borderRadius: 999, padding: '5px 14px', whiteSpace: 'nowrap' }}>{name}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* STATS */}
      <section style={{ background: '#fff', padding: '80px 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: '#e8e8e4', borderRadius: 16, overflow: 'hidden', maxWidth: 900, margin: '0 auto' }} className="lp-stats">
          {[
            { target: 2000, suffix: '+', label: 'Recipients per campaign' },
            { target: 98, suffix: '%', label: 'Delivery rate on valid numbers' },
            { target: 30, suffix: 's', label: 'Time to first message' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', padding: '48px 32px', textAlign: 'center' }}>
              <AnimatedNumber target={s.target} suffix={s.suffix} />
              <div style={{ fontSize: 14, color: '#888', marginTop: 10 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ background: '#fafaf8', padding: '80px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Features</p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 700, letterSpacing: '-1px', marginBottom: 40, maxWidth: 600 }}>
            Everything your org needs to communicate at scale
          </h2>

          <img src="/images/tinywow_feature-speed_89426003.png" alt="Fast messaging" style={{ width: '100%', maxWidth: 400, height: 'auto', display: 'block', margin: '0 auto 48px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }} className="lp-features">
            {features.map(f => (
              <div key={f.title} style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 16, padding: 28 }}>
                <div style={{ width: 44, height: 44, background: '#f5f5f3', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>{f.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{f.title}</div>
                <div style={{ fontSize: 14, color: '#777', lineHeight: 1.65 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{ background: '#fff', padding: '80px 48px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>How it works</p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 700, letterSpacing: '-1px', marginBottom: 64 }}>Up and running in four steps</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0 }} className="lp-steps">
            {[
              { n: 1, title: 'Create account', desc: 'Sign up with your organization email in under a minute.' },
              { n: 2, title: 'Connect WhatsApp', desc: 'Scan a QR code with your phone to link your number.' },
              { n: 3, title: 'Load contacts', desc: 'Upload CSV, paste numbers, or sync from WhatsApp directly.' },
              { n: 4, title: 'Send your campaign', desc: 'Write your message and watch delivery happen live.' },
            ].map((s, i) => (
              <div key={s.n} style={{ paddingRight: i < 3 ? 24 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#0a0a0a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, flexShrink: 0 }}>{s.n}</div>
                  {i < 3 && <div style={{ flex: 1, height: '0.5px', background: '#e8e8e4', marginLeft: 12 }} />}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: '#777', lineHeight: 1.6, maxWidth: 180 }}>{s.desc}</div>
              </div>
            ))}
          </div>

          {/* QR image centered below steps */}
          <div style={{ textAlign: 'center', marginTop: 56 }}>
            <p style={{ fontSize: 13, color: '#999', marginBottom: 20 }}>Step 2 — scan this with your phone</p>
            <img
              src="/images/tinywow_qr-connect_89426015.png"
              alt="Scan QR code to connect WhatsApp"
              style={{ width: 340, height: 'auto', display: 'block', margin: '0 auto' }}
            />
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ background: '#fafaf8', padding: '80px 48px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Pricing</p>
        <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 700, letterSpacing: '-1px', marginBottom: 8 }}>Simple, honest pricing</h2>
        <p style={{ fontSize: 16, color: '#777', marginBottom: 48 }}>Start free. Upgrade when you need more.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 780, margin: '0 auto' }} className="lp-pricing">
          <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 16, padding: 36, textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', marginBottom: 16 }}>Starter</p>
            <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-2px', marginBottom: 8 }}>Free</div>
            <p style={{ fontSize: 14, color: '#777', marginBottom: 28 }}>For small organizations getting started</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              {['Up to 200 messages per month','1 WhatsApp number','CSV upload and paste','Basic delivery reports'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#444' }}><CheckIcon />{f}</div>
              ))}
            </div>
            <button onClick={goRegister} style={{ width: '100%', fontSize: 14, fontWeight: 600, color: '#0a0a0a', padding: '12px 0', border: '1.5px solid #0a0a0a', borderRadius: 8, background: 'transparent', cursor: 'pointer' }}>
              Get started free
            </button>
          </div>

          <div style={{ background: '#0a0a0a', borderRadius: 16, padding: 36, textAlign: 'left' }}>
            <div style={{ display: 'inline-block', background: '#25D366', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 999, marginBottom: 16 }}>Most popular</div>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: '#555', textTransform: 'uppercase', marginBottom: 16 }}>Pro</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-2px', color: '#fff' }}>N15,000</span>
              <span style={{ fontSize: 16, color: '#666' }}>/mo</span>
            </div>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 28 }}>For active organizations sending at scale</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              {['Unlimited messages','Multiple WhatsApp numbers','WhatsApp contact sync','Message scheduling','Priority support','Export reports as CSV'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#ccc' }}><CheckIcon pro />{f}</div>
              ))}
            </div>
            <button onClick={goRegister} style={{ width: '100%', fontSize: 14, fontWeight: 600, color: '#fff', padding: '12px 0', background: '#25D366', borderRadius: 8, border: 'none', cursor: 'pointer' }}>
              Start free trial
            </button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: '#0a0a0a', padding: '100px 48px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(32px,5vw,52px)', fontWeight: 700, color: '#fff', letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 20 }}>
          Ready to reach<br />every member?
        </h2>
        <p style={{ fontSize: 17, color: '#666', marginBottom: 36 }}>Join organizations already using BulkIt to communicate at scale.</p>
        <button onClick={goRegister} style={{ fontSize: 16, fontWeight: 600, color: '#fff', padding: '16px 40px', borderRadius: 10, background: '#25D366', border: 'none', cursor: 'pointer' }}>
          Start sending free
        </button>
        <p style={{ fontSize: 13, color: '#555', marginTop: 16 }}>Free to start. No credit card required.</p>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#0a0a0a', borderTop: '0.5px solid #1c1c1a', padding: '40px 48px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <img src="/images/bulkit-logo-removebg-preview.png" width="28" height="28" alt="BulkIt" style={{ borderRadius: 6 }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>BulkIt</span>
          </div>
          <p style={{ fontSize: 13, color: '#555' }}>2026 BulkIt</p>
        </div>
        <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, maxWidth: 260 }}>
          WhatsApp broadcast tool for organizations that communicate.
        </p>
        <div style={{ display: 'flex', gap: 20 }}>
          {['Privacy','Terms','Contact'].map(l => (
            <a key={l} href="#" style={{ fontSize: 13, color: '#555', textDecoration: 'none' }}
              onMouseEnter={e => e.target.style.color='#fff'}
              onMouseLeave={e => e.target.style.color='#555'}>{l}</a>
          ))}
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        .lp-marquee {
          display: flex;
          width: max-content;
          animation: marquee 30s linear infinite;
        }
        .lp-marquee:hover { animation-play-state: paused; }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        @media (max-width: 768px) {
          .lp-nav-links, .lp-nav-actions { display: none !important; }
          .lp-hamburger { display: block !important; }
          .lp-features { grid-template-columns: 1fr !important; }
          .lp-pricing { grid-template-columns: 1fr !important; }
          .lp-stats { grid-template-columns: 1fr !important; }
          .lp-steps { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
          nav { padding: 0 20px !important; }
        }
        @media (max-width: 480px) {
          .lp-steps { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
