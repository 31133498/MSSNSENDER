import { useState } from 'react'

const APP_URL = 'https://bulkit-beta.vercel.app'

function Logo({ size = 32, dark = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="2" y="2" width="12" height="12" rx="3" fill="#25D366"/>
      <rect x="18" y="2" width="12" height="12" rx="3" fill={dark ? '#fff' : '#0a0a0a'} opacity="0.5"/>
      <rect x="2" y="18" width="12" height="12" rx="3" fill={dark ? '#fff' : '#0a0a0a'} opacity="0.3"/>
      <rect x="18" y="18" width="12" height="12" rx="3" fill={dark ? '#fff' : '#0a0a0a'} opacity="0.15"/>
    </svg>
  )
}

function CheckIcon({ pro = false }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="6" fill={pro ? '#1a3a1a' : '#f0fdf4'}/>
      <path d="M4 7l2 2 4-4" stroke={pro ? '#25D366' : '#166534'} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export default function LandingScreen({ onNavigate }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#fff', color: '#0a0a0a', margin: 0, padding: 0 }}>

      {/* ── NAVBAR ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#fff', borderBottom: '0.5px solid #e8e8e4',
        padding: '0 48px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <Logo size={32} />
          <span style={{ fontSize: 17, fontWeight: 700, color: '#0a0a0a', letterSpacing: '-0.3px' }}>BulkIt</span>
        </a>

        <div className="nav-links" style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          {[['#features','Features'],['#how-it-works','How it works'],['#pricing','Pricing']].map(([href, label]) => (
            <a key={href} href={href} style={{ fontSize: 14, color: '#444', textDecoration: 'none', fontWeight: 500 }}
              onMouseEnter={e => e.target.style.color='#0a0a0a'}
              onMouseLeave={e => e.target.style.color='#444'}>{label}</a>
          ))}
        </div>

        <div className="nav-actions" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => onNavigate('login')} style={{
            fontSize: 14, fontWeight: 500, color: '#0a0a0a', cursor: 'pointer',
            padding: '8px 16px', borderRadius: 8, border: '1px solid #e8e8e4',
            background: 'transparent', transition: 'background 0.15s'
          }}
            onMouseEnter={e => e.target.style.background='#f5f5f3'}
            onMouseLeave={e => e.target.style.background='transparent'}>Sign in</button>
          <button onClick={() => onNavigate('login')} style={{
            fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer',
            padding: '8px 18px', borderRadius: 8, background: '#0a0a0a', border: 'none',
            transition: 'opacity 0.15s'
          }}
            onMouseEnter={e => e.target.style.opacity='0.85'}
            onMouseLeave={e => e.target.style.opacity='1'}>Get started free</button>
        </div>

        <button className="hamburger" onClick={() => setMenuOpen(o => !o)} style={{
          display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8
        }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M3 6h16M3 11h16M3 16h16" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </nav>

      {menuOpen && (
        <div style={{
          background: '#fff', borderBottom: '0.5px solid #e8e8e4',
          padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16
        }}>
          {[['#features','Features'],['#how-it-works','How it works'],['#pricing','Pricing']].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)}
              style={{ fontSize: 15, color: '#0a0a0a', textDecoration: 'none', fontWeight: 500 }}>{label}</a>
          ))}
          <a href={APP_URL} style={{ fontSize: 15, fontWeight: 600, color: '#fff', textDecoration: 'none', padding: '10px 0', background: '#0a0a0a', borderRadius: 8, textAlign: 'center' }}>Get started free</a>
        </div>
      )}

      {/* ── HERO ── */}
      <section style={{ padding: '120px 24px 80px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#f0fdf4', border: '0.5px solid #86efac',
          borderRadius: 999, padding: '6px 14px', marginBottom: 32
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#25D366', display: 'inline-block' }}/>
          <span style={{ fontSize: 13, color: '#166534', fontWeight: 500 }}>Now live — send to 2,000+ members</span>
        </div>

        <h1 style={{
          fontSize: 'clamp(40px, 7vw, 64px)', fontWeight: 700,
          letterSpacing: '-2px', lineHeight: 1.08,
          maxWidth: 800, margin: '0 0 24px'
        }}>
          WhatsApp outreach,<br />
          done <span style={{ color: '#25D366' }}>properly.</span>
        </h1>

        <p style={{
          fontSize: 19, color: '#666', maxWidth: 520,
          lineHeight: 1.6, margin: '0 0 40px'
        }}>
          BulkIt lets organizations send personal WhatsApp messages to every member — without broadcast limits, without the noise of group chats.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
          <a href={APP_URL} style={{
            fontSize: 15, fontWeight: 600, color: '#fff', textDecoration: 'none',
            padding: '14px 28px', borderRadius: 8, background: '#0a0a0a',
            transition: 'opacity 0.15s'
          }}
            onMouseEnter={e => e.target.style.opacity='0.8'}
            onMouseLeave={e => e.target.style.opacity='1'}>Start sending free</a>
          <a href="#how-it-works" style={{
            fontSize: 15, fontWeight: 600, color: '#0a0a0a', textDecoration: 'none',
            padding: '14px 28px', borderRadius: 8, background: '#fff',
            border: '1px solid #0a0a0a', transition: 'background 0.15s'
          }}
            onMouseEnter={e => e.target.style.background='#f5f5f3'}
            onMouseLeave={e => e.target.style.background='#fff'}>See how it works</a>
        </div>

        <p style={{ fontSize: 13, color: '#999', margin: '0 0 64px' }}>No credit card required. Connect in 30 seconds.</p>

        <div style={{ width: '100%', maxWidth: 900 }}>
          <img src="/images/hero-mockup.png" alt="BulkIt dashboard"
            style={{
              width: '100%', borderRadius: 16,
              border: '0.5px solid #e8e8e4',
              background: '#f5f5f3', minHeight: 400,
              display: 'block'
            }}
            onError={e => { e.target.style.minHeight = '400px'; e.target.src = '' }}
          />
        </div>
      </section>

      {/* ── SOCIAL PROOF BAR ── */}
      <div style={{
        background: '#fafaf8',
        borderTop: '0.5px solid #e8e8e4', borderBottom: '0.5px solid #e8e8e4',
        padding: '20px 48px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 16
      }}>
        <span style={{ fontSize: 13, color: '#999' }}>Trusted by organizations including</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['MSSN Unilag', 'Student Unions', 'Campus Mosques', 'NGOs', 'Business Associations'].map(name => (
            <span key={name} style={{
              fontSize: 12, fontWeight: 500, color: '#555',
              background: '#fff', border: '0.5px solid #e8e8e4',
              borderRadius: 999, padding: '5px 12px'
            }}>{name}</span>
          ))}
        </div>
      </div>

      {/* ── STATS ── */}
      <section style={{ background: '#fff', padding: '80px 48px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1, background: '#e8e8e4',
          borderRadius: 16, overflow: 'hidden',
          maxWidth: 900, margin: '0 auto'
        }}>
          {[
            { num: '2,000+', label: 'Recipients per campaign' },
            { num: '98%', label: 'Delivery rate on valid numbers' },
            { num: '30s', label: 'Time to first message' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: '-2px', lineHeight: 1 }}>{s.num}</div>
              <div style={{ fontSize: 14, color: '#888', marginTop: 10 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ background: '#fafaf8', padding: '80px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Features</p>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, letterSpacing: '-1px', marginBottom: 48, maxWidth: 600 }}>
            Everything your org needs to communicate at scale
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }} className="features-grid">
            {[
              {
                title: 'Paste and send instantly',
                desc: 'Drop numbers in any format. BulkIt auto-formats to international standard and sends within seconds.',
                icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M20 2L9 13M20 2L14 20L9 13M20 2L2 9L9 13" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              },
              {
                title: 'CSV bulk upload',
                desc: 'Upload your full member list with names, phone numbers, and groups. Send to all or filter by subgroup.',
                icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="3" width="16" height="16" rx="3" stroke="#0a0a0a" strokeWidth="1.5"/><path d="M3 9h16M3 15h16M9 3v16" stroke="#0a0a0a" strokeWidth="1.5"/></svg>
              },
              {
                title: 'Name personalization',
                desc: 'Use {{name}} to address every member individually. Every message feels personal, never like a mass blast.',
                icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="8" r="4" stroke="#0a0a0a" strokeWidth="1.5"/><path d="M3 20c0-4 3.582-7 8-7s8 3 8 7" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/></svg>
              },
              {
                title: 'Anti-ban protection',
                desc: 'Smart 3–6 second delays between messages protect your account. Automatic pause every 50 messages.',
                icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 2L4 5.5v6c0 4.4 3.1 8.5 7 9.5 3.9-1 7-5.1 7-9.5v-6L11 2z" stroke="#0a0a0a" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 11l2 2 4-4" stroke="#25D366" strokeWidth="1.5" strokeLinecap="round"/></svg>
              },
              {
                title: 'Live delivery tracking',
                desc: 'Watch sends happen in real time. Full per-recipient report showing delivered, failed, and error reasons.',
                icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 18V10M9 18V6M14 18V12M19 18V4" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/></svg>
              },
              {
                title: 'Your own WhatsApp number',
                desc: 'Connect any WhatsApp number via QR scan. Recipients see your real number — not a random shortcode.',
                icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M16 14.5c-1 1-1 2-2 2-2.5 0-6.5-4-8.5-8.5 0-1 1-1 2-2L9 3.5c.5-.5.5-1.5 0-2L7 0c-.5-.5-1.5-.5-2 0C2.5 2.5 1 5 1 8.5c0 6.5 5.5 12 12 12 3.5 0 6-1.5 8.5-4 .5-.5.5-1.5 0-2L19.5 12c-.5-.5-1.5-.5-2 0L16 14.5z" stroke="#0a0a0a" strokeWidth="1.5" strokeLinejoin="round"/></svg>
              },
            ].map(f => (
              <div key={f.title} style={{
                background: '#fff', border: '0.5px solid #e8e8e4',
                borderRadius: 16, padding: 32,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}>
                <div style={{
                  width: 44, height: 44, background: '#f5f5f3',
                  borderRadius: 12, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', marginBottom: 20
                }}>{f.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{f.title}</div>
                <div style={{ fontSize: 14, color: '#777', lineHeight: 1.65 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ background: '#fff', padding: '80px 48px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>How it works</p>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, letterSpacing: '-1px', marginBottom: 64 }}>Up and running in four steps</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, position: 'relative' }} className="steps-grid">
            {[
              { n: 1, title: 'Create account', desc: 'Sign up with your organization email.' },
              { n: 2, title: 'Connect WhatsApp', desc: 'Scan QR code to link your number.' },
              { n: 3, title: 'Load contacts', desc: 'CSV, paste, or sync from WhatsApp.' },
              { n: 4, title: 'Send campaign', desc: 'Write message and watch delivery live.' },
            ].map((s, i) => (
              <div key={s.n} style={{ padding: '0 24px 0 0', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: '#0a0a0a', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 600, flexShrink: 0
                  }}>{s.n}</div>
                  {i < 3 && <div style={{ flex: 1, height: '0.5px', background: '#e8e8e4', marginLeft: 12 }}/>}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: '#777', lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ background: '#fafaf8', padding: '80px 48px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Pricing</p>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, letterSpacing: '-1px', marginBottom: 8 }}>Simple, honest pricing</h2>
        <p style={{ fontSize: 16, color: '#777', marginBottom: 48 }}>Start free. Upgrade when you need more.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 760, margin: '0 auto' }} className="pricing-grid">
          {/* Starter */}
          <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 16, padding: 36, textAlign: 'left' }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', marginBottom: 16 }}>Starter</p>
            <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-2px', marginBottom: 8 }}>Free</div>
            <p style={{ fontSize: 14, color: '#777', marginBottom: 28 }}>For small organizations getting started</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              {['Up to 200 messages per month','1 WhatsApp number','CSV upload and paste','Basic delivery reports'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#444' }}>
                  <CheckIcon />{f}
                </div>
              ))}
            </div>
            <a href={APP_URL} style={{
              display: 'block', textAlign: 'center', fontSize: 14, fontWeight: 600,
              color: '#0a0a0a', textDecoration: 'none', padding: '12px 0',
              border: '1.5px solid #0a0a0a', borderRadius: 8, transition: 'background 0.15s'
            }}
              onMouseEnter={e => e.target.style.background='#f5f5f3'}
              onMouseLeave={e => e.target.style.background='transparent'}>Get started free</a>
          </div>

          {/* Pro */}
          <div style={{ background: '#0a0a0a', borderRadius: 16, padding: 36, textAlign: 'left', position: 'relative' }}>
            <div style={{
              display: 'inline-block', background: '#25D366', color: '#fff',
              fontSize: 11, fontWeight: 700, padding: '4px 12px',
              borderRadius: 999, marginBottom: 16
            }}>Most popular</div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#666', textTransform: 'uppercase', marginBottom: 16 }}>Pro</p>
            <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-2px', color: '#fff', marginBottom: 4 }}>₦15,000</div>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>/month</div>
            <p style={{ fontSize: 14, color: '#888', marginBottom: 28 }}>For active organizations sending at scale</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              {['Unlimited messages','Multiple WhatsApp numbers','WhatsApp contact sync','Message scheduling','Priority support','Export reports as CSV'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#ccc' }}>
                  <CheckIcon pro />{f}
                </div>
              ))}
            </div>
            <a href={APP_URL} style={{
              display: 'block', textAlign: 'center', fontSize: 14, fontWeight: 600,
              color: '#fff', textDecoration: 'none', padding: '12px 0',
              background: '#25D366', borderRadius: 8, transition: 'opacity 0.15s'
            }}
              onMouseEnter={e => e.target.style.opacity='0.85'}
              onMouseLeave={e => e.target.style.opacity='1'}>Start free trial</a>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: '#0a0a0a', padding: '100px 48px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, color: '#fff', letterSpacing: '-1.5px', marginBottom: 16 }}>
          Ready to reach every member?
        </h2>
        <p style={{ fontSize: 17, color: '#666', marginBottom: 40 }}>Join organizations already using BulkIt.</p>
        <a href={APP_URL} style={{
          display: 'inline-block', fontSize: 16, fontWeight: 600,
          color: '#fff', textDecoration: 'none',
          padding: '16px 40px', borderRadius: 10, background: '#25D366',
          transition: 'opacity 0.15s'
        }}
          onMouseEnter={e => e.target.style.opacity='0.85'}
          onMouseLeave={e => e.target.style.opacity='1'}>Start sending free</a>
        <p style={{ fontSize: 13, color: '#555', marginTop: 16 }}>Free to start. No credit card required.</p>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        background: '#0a0a0a', borderTop: '0.5px solid #1c1c1c',
        padding: '32px 48px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size={28} dark />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>BulkIt</span>
        </div>
        <span style={{ fontSize: 13, color: '#555' }}>© 2026 BulkIt. All rights reserved.</span>
        <div style={{ display: 'flex', gap: 20 }}>
          {['Privacy','Terms','Contact','GitHub'].map(l => (
            <a key={l} href="#" style={{ fontSize: 13, color: '#555', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => e.target.style.color='#fff'}
              onMouseLeave={e => e.target.style.color='#555'}>{l}</a>
          ))}
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        @media (max-width: 768px) {
          .nav-links, .nav-actions { display: none !important; }
          .hamburger { display: block !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
          nav { padding: 0 20px !important; }
          section, footer { padding-left: 20px !important; padding-right: 20px !important; }
        }
        @media (max-width: 480px) {
          .steps-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
