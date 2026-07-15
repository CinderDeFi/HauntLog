// src/pages/Landing.tsx
import { Link } from 'react-router-dom';
import { Zap, Radio, Thermometer, Mic, Volume2, Star } from 'lucide-react';
import { useAuth } from '../lib/useAuth';

export default function Landing() {
  const { status } = useAuth();
  const isSignedIn = status === 'signed_in';
  const primaryHref = isSignedIn ? '/app/live' : '/auth/signup';
  const primaryLabel = isSignedIn ? 'OPEN APP' : 'SIGN UP — FREE';
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* HEADER */}
      <header className="border-b border-white/10">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-8 py-4 md:py-6 flex items-center justify-between gap-x-2">
          <div className="flex items-center gap-x-2 md:gap-x-3 min-w-0">
            <img 
              src="/hauntlog-mark-color.svg" 
              alt="HauntLog" 
              className="h-7 w-7 md:h-9 md:w-9 shrink-0" 
            />
            <span className="font-mono text-xl md:text-3xl tracking-[-1px] md:tracking-[-2px] text-white">HAUNTLOG</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-x-8 text-sm font-medium">
            <a href="#features" className="hover:text-haunt-red transition-colors">FEATURES</a>
            <a href="#evidence" className="hover:text-haunt-red transition-colors">EVIDENCE</a>
            <a href="#venues" className="hover:text-haunt-red transition-colors">LOCATIONS</a>
            <a href="#pricing" className="hover:text-haunt-red transition-colors">PRICING</a>
          </nav>

          <div className="flex items-center gap-x-2 md:gap-x-3 shrink-0">
            {!isSignedIn && (
              <Link
                to="/auth/signin"
                className="px-2 md:px-6 py-2 md:py-3 text-white/70 hover:text-white text-xs md:text-sm font-medium tracking-wide whitespace-nowrap"
              >
                SIGN IN
              </Link>
            )}
            <Link
              to={primaryHref}
              className="px-4 md:px-8 py-2.5 md:py-3.5 bg-white text-black rounded-xl md:rounded-2xl font-semibold hover:bg-haunt-red hover:text-white transition-all active:scale-95 text-xs md:text-base whitespace-nowrap"
            >
              {primaryLabel}
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-screen-2xl mx-auto px-6 md:px-8 pt-12 md:pt-20 pb-12 md:pb-16">
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-12 items-center">
          <div className="flex-1 w-full">
            <div className="inline-flex items-center gap-x-2 md:gap-x-3 bg-white/10 rounded-3xl px-3 md:px-6 py-1.5 md:py-3 text-[10px] md:text-sm mb-6 md:mb-8">
              <div className="relative flex h-2.5 w-2.5 md:h-3 md:w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 md:h-3 md:w-3 bg-red-500"></span>
              </div>
              NOW ACCEPTING EARLY HUNTERS
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-medium leading-none tracking-[-2px] md:tracking-[-3px] mb-6">
              The haunt is<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-haunt-red">unrecorded.</span><br />
              Logged.
            </h1>
            
            <p className="max-w-lg text-lg md:text-2xl text-white/70 leading-tight mb-8 md:mb-10">
              A real evidence vault for paranormal investigators. Log your K-II hits, REM pod alerts, and SB7 captures with timestamp precision.
            </p>
            
            <div className="flex flex-wrap gap-3 md:gap-4">
              <Link
                to={primaryHref}
                className="inline-flex items-center gap-x-2 md:gap-x-3 bg-haunt-red hover:bg-red-600 text-white px-6 md:px-10 py-4 md:py-6 text-base md:text-xl font-medium rounded-2xl md:rounded-3xl transition-all active:scale-95"
              >
                <span>{primaryLabel}</span>
                <span className="text-xl md:text-2xl" aria-hidden="true">→</span>
              </Link>
              
              <a 
                href="#how" 
                className="px-6 md:px-10 py-4 md:py-6 border border-white/30 hover:border-white/60 rounded-2xl md:rounded-3xl text-base md:text-xl font-medium flex items-center gap-x-3 transition-colors"
              >
                HOW IT WORKS
              </a>
            </div>

            {/* Trust line */}
            <div className="mt-10 md:mt-16 flex items-center gap-x-6 md:gap-x-8 text-xs md:text-sm text-white/60">
              <div className="flex -space-x-3 md:-space-x-4 shrink-0">
                <div className="w-7 h-7 md:w-8 md:h-8 bg-white/10 backdrop-blur rounded-2xl border border-white/30 flex items-center justify-center text-[10px] md:text-xs">K</div>
                <div className="w-7 h-7 md:w-8 md:h-8 bg-white/10 backdrop-blur rounded-2xl border border-white/30 flex items-center justify-center text-[10px] md:text-xs">R</div>
                <div className="w-7 h-7 md:w-8 md:h-8 bg-white/10 backdrop-blur rounded-2xl border border-white/30 flex items-center justify-center text-[10px] md:text-xs">S</div>
              </div>
              <div className="leading-tight">Trusted by 200+ hunters at<br />Samuel Miller Mansion, Fort Mifflin &amp; more</div>
            </div>
          </div>

          {/* Hero visual */}
          <div className="flex-1 relative w-full max-w-md lg:max-w-none">
            <div className="aspect-square bg-gradient-to-br from-zinc-900 to-black rounded-[3rem] md:rounded-[4rem] border border-white/10 p-6 md:p-8 shadow-2xl">
              <img 
                src="/hauntlog-app-icon-1024.svg" 
                alt="HauntLog App" 
                className="w-full h-full object-contain drop-shadow-2xl" 
              />
            </div>
            {/* Floating badge */}
            <div className="absolute -top-3 -right-3 md:-top-6 md:-right-6 bg-white text-black text-[10px] md:text-xs font-mono px-3 md:px-6 py-2 md:py-3 rounded-2xl md:rounded-3xl shadow-xl flex items-center gap-x-2 rotate-12">
              <span className="text-green-500">●</span>
              LIVE HUNT ACTIVE
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="bg-zinc-900 py-6 md:py-8 border-y border-white/10">
        <div className="max-w-screen-2xl mx-auto px-6 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center">
          <div>
            <div className="text-3xl md:text-5xl font-mono text-haunt-red">5</div>
            <div className="text-white/60 text-[10px] md:text-sm tracking-widest mt-1">DEVICE TYPES</div>
            <div className="flex justify-center gap-x-2 md:gap-x-4 mt-3 md:mt-4">
              <Zap className="w-4 h-4 md:w-5 md:h-5" />
              <Radio className="w-4 h-4 md:w-5 md:h-5" />
              <Thermometer className="w-4 h-4 md:w-5 md:h-5" />
              <Mic className="w-4 h-4 md:w-5 md:h-5" />
              <Volume2 className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl md:text-5xl font-mono text-haunt-red">12hr</div>
            <div className="text-white/60 text-[10px] md:text-sm tracking-widest mt-1">PARTNER LOCATIONS</div>
          </div>
          <div>
            <div className="text-3xl md:text-5xl font-mono text-haunt-red">∞</div>
            <div className="text-white/60 text-[10px] md:text-sm tracking-widest mt-1">CASE FILES</div>
          </div>
          <div>
            <div className="text-3xl md:text-5xl font-mono text-haunt-red">2026</div>
            <div className="text-white/60 text-[10px] md:text-sm tracking-widest mt-1">LAUNCH YEAR</div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section id="evidence" className="max-w-screen-2xl mx-auto px-6 md:px-8 py-12 md:py-20">
        <div className="max-w-2xl mx-auto text-center">
          <div className="uppercase text-[10px] md:text-xs tracking-[2px] text-haunt-red mb-3 md:mb-4">— THE PROBLEM —</div>
          <h2 className="text-2xl md:text-5xl font-medium leading-snug md:leading-tight">
            Every ghost-hunting app on your phone is faking the readings.<br className="hidden md:block" />
            <span className="text-white/70">You bought a K-II. You bought a REM pod. You hauled an SB7 to a 200-year-old mansion.</span><br className="hidden md:block" />
            Why is your phone pretending to do their job?
          </h2>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="bg-zinc-950 py-12 md:py-20">
        <div className="max-w-screen-2xl mx-auto px-6 md:px-8">
          <div className="text-center mb-10 md:mb-16">
            <div className="inline-block px-4 md:px-5 py-1.5 md:py-2 bg-white/10 text-white/80 rounded-3xl text-xs md:text-sm font-medium">// FEATURES</div>
            <h2 className="text-3xl md:text-5xl font-medium mt-4 leading-tight">Your gear is real.<br />Your evidence should be too.</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
            {/* Feature 1 */}
            <div className="hl-lift bg-black border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-8 hover:border-haunt-red/50 group">
              <div className="flex items-center gap-x-3 md:gap-x-4 mb-4 md:mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-red-500/10 text-haunt-red rounded-xl md:rounded-2xl flex items-center justify-center text-xl md:text-2xl shrink-0">01</div>
                <div className="min-w-0">
                  <div className="font-mono text-lg md:text-xl">KIT</div>
                  <div className="text-white/60 text-xs md:text-sm">Log from your actual gear</div>
                </div>
              </div>
              <p className="text-white/70 mb-6 md:mb-8 text-sm md:text-base">Tap your K-II reading the moment it spikes. Log a REM pod burst, a thermal drop, an SB7 word capture, all with one-second precision.</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs md:text-sm font-mono text-white/70">
                <div>K-II</div>
                <div>REM POD</div>
                <div>THERMAL</div>
                <div>SB7</div>
                <div>H4n</div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="hl-lift bg-black border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-8 hover:border-haunt-red/50 group">
              <div className="flex items-center gap-x-3 md:gap-x-4 mb-4 md:mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-red-500/10 text-haunt-red rounded-xl md:rounded-2xl flex items-center justify-center text-xl md:text-2xl shrink-0">02</div>
                <div className="min-w-0">
                  <div className="font-mono text-lg md:text-xl">CASES</div>
                  <div className="text-white/60 text-xs md:text-sm">Cinematic case files</div>
                </div>
              </div>
              <p className="text-white/70 mb-6 md:mb-8 text-sm md:text-base">Every hunt becomes a sealed dossier with location, zone, equipment used, and chronological event log. Export to PDF or share via vanity URL.</p>
              <div className="text-xs md:text-sm font-mono uppercase text-haunt-red">SEALED · TIMESTAMPED · EXPORTABLE</div>
            </div>

            {/* Feature 3 */}
            <div className="hl-lift bg-black border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-8 hover:border-haunt-red/50 group">
              <div className="flex items-center gap-x-3 md:gap-x-4 mb-4 md:mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-red-500/10 text-haunt-red rounded-xl md:rounded-2xl flex items-center justify-center text-xl md:text-2xl shrink-0">03</div>
                <div className="min-w-0">
                  <div className="font-mono text-lg md:text-xl">ATLAS</div>
                  <div className="text-white/60 text-xs md:text-sm">The haunted atlas</div>
                </div>
              </div>
              <p className="text-white/70 mb-6 md:mb-8 text-sm md:text-base">Discover locations. See who's hunting tonight. Cross-reference your evidence with hunters at the same place, same minute.</p>
              <div className="text-xs md:text-sm font-mono">847 LOCATIONS · GROWING WEEKLY</div>
            </div>

            {/* Feature 4 */}
            <div className="hl-lift bg-black border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-8 hover:border-haunt-red/50 group">
              <div className="flex items-center gap-x-3 md:gap-x-4 mb-4 md:mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-red-500/10 text-haunt-red rounded-xl md:rounded-2xl flex items-center justify-center text-xl md:text-2xl shrink-0">04</div>
                <div className="min-w-0">
                  <div className="font-mono text-lg md:text-xl">TEAMS</div>
                  <div className="text-white/60 text-xs md:text-sm">Brand every hunt</div>
                </div>
              </div>
              <p className="text-white/70 text-sm md:text-base">Add your team logo, your channel, your handle. Every case file gets your watermark — and a TikTok-ready highlight reel.</p>
            </div>

            {/* Feature 5 */}
            <div className="hl-lift bg-black border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-8 hover:border-haunt-red/50 group">
              <div className="flex items-center gap-x-3 md:gap-x-4 mb-4 md:mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-red-500/10 text-haunt-red rounded-xl md:rounded-2xl flex items-center justify-center text-xl md:text-2xl shrink-0">05</div>
                <div className="min-w-0">
                  <div className="font-mono text-lg md:text-xl">LOCATIONS</div>
                  <div className="text-white/60 text-xs md:text-sm">Book directly with partner locations</div>
                </div>
              </div>
              <p className="text-white/70 mb-4 md:mb-6 text-sm md:text-base">Real haunted locations. Verified by us, owned by them. Private overnight bookings.</p>
              <div className="text-[10px] md:text-xs font-medium">FEATURING: SAMUEL MILLER MANSION</div>
            </div>

            {/* Feature 6 */}
            <div className="hl-lift bg-black border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-8 hover:border-haunt-red/50 group">
              <div className="flex items-center gap-x-3 md:gap-x-4 mb-4 md:mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-red-500/10 text-haunt-red rounded-xl md:rounded-2xl flex items-center justify-center text-xl md:text-2xl shrink-0">06</div>
                <div className="min-w-0">
                  <div className="font-mono text-lg md:text-xl">COMMUNITY</div>
                  <div className="text-white/60 text-xs md:text-sm">Vote, verify, build trust</div>
                </div>
              </div>
              <p className="text-white/70 text-sm md:text-base">The community decides what's real. Verdict votes, verified hunter badges, class ratings from I to V.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SAMPLE CASE */}
      <section className="max-w-screen-2xl mx-auto px-6 md:px-8 py-12 md:py-20 border-t border-b border-white/10" id="sample">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-center">
            <div className="flex-1 w-full">
              <div className="uppercase text-[10px] md:text-xs tracking-widest text-haunt-red mb-2 md:mb-3">// SAMPLE CASE</div>
              <h2 className="text-3xl md:text-5xl font-medium mb-4 md:mb-6 leading-tight">Real events.<br />Real time stamps.</h2>
              <p className="text-white/70 max-w-md text-sm md:text-base">No fake spikes. No simulated voices. Just the moments your gear actually reacted — all locked into a sealed file the community can vote on.</p>
              
              <Link to="/case/sample" className="inline-flex mt-6 md:mt-8 items-center gap-x-2 md:gap-x-3 text-haunt-red hover:text-red-400 text-sm md:text-base">
                SEE THE FULL SAMPLE CASE
                <span className="text-2xl md:text-3xl leading-none">→</span>
              </Link>
            </div>

            {/* Sample case card — clickable too */}
            <Link to="/case/sample" className="hl-lift flex-1 w-full bg-zinc-900 border border-white/10 rounded-2xl md:rounded-3xl p-5 md:p-8 max-w-lg hover:border-haunt-red/40 hover:bg-zinc-900/80 group">
              <div className="flex justify-between items-center mb-4 md:mb-6 gap-2">
                <div className="font-mono text-[10px] md:text-sm bg-white/10 px-3 md:px-4 py-1 rounded-xl md:rounded-2xl">CASE FILE · SEALED</div>
                <div className="text-[10px] md:text-xs text-white/40 shrink-0">#SAMPLE</div>
              </div>
              
              <div className="flex items-baseline gap-x-2 md:gap-x-3 mb-3 md:mb-4">
                <span className="text-3xl md:text-5xl">★</span>
                <span className="text-2xl md:text-4xl font-medium">CLASS III</span>
              </div>
              <h3 className="text-xl md:text-3xl font-medium group-hover:text-haunt-red transition-colors">The whispering tenant</h3>
              <p className="text-white/60 text-xs md:text-base mt-1">OLD LYON THEATRE · STAGE LEFT</p>

              <div className="mt-6 md:mt-8 space-y-4 md:space-y-6">
                <div className="flex gap-x-3 md:gap-x-4 items-baseline">
                  <div className="w-14 md:w-20 font-mono text-[10px] md:text-xs text-white/40 shrink-0">22:14</div>
                  <div className="flex-1 min-w-0 text-sm md:text-base">
                    <span className="px-2 md:px-3 py-0.5 md:py-1 bg-purple-500/10 text-purple-400 text-[10px] md:text-xs rounded-lg md:rounded-xl">SB7</span>
                    <span className="ml-2 md:ml-4">"don't leave"</span>
                  </div>
                </div>
                <div className="flex gap-x-3 md:gap-x-4 items-baseline">
                  <div className="w-14 md:w-20 font-mono text-[10px] md:text-xs text-white/40 shrink-0">22:14</div>
                  <div className="flex-1 min-w-0 text-sm md:text-base">
                    <span className="px-2 md:px-3 py-0.5 md:py-1 bg-red-500/10 text-red-400 text-[10px] md:text-xs rounded-lg md:rounded-xl">K-II</span>
                    <span className="ml-2 md:ml-4">spike to red (5+)</span>
                  </div>
                </div>
                <div className="flex gap-x-3 md:gap-x-4 items-baseline">
                  <div className="w-14 md:w-20 font-mono text-[10px] md:text-xs text-white/40 shrink-0">22:51</div>
                  <div className="flex-1 min-w-0 text-sm md:text-base">
                    <span className="px-2 md:px-3 py-0.5 md:py-1 bg-cyan-500/10 text-cyan-400 text-[10px] md:text-xs rounded-lg md:rounded-xl">THERMAL</span>
                    <span className="ml-2 md:ml-4">drop -14°F</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 md:mt-12 flex items-center justify-between text-[10px] md:text-xs font-mono border-t pt-5 md:pt-8 border-white/10 gap-2">
                <div className="flex items-center gap-x-2 min-w-0">
                  <div className="w-6 h-6 bg-white/10 rounded-2xl flex items-center justify-center text-[10px] md:text-xs shrink-0">RH</div>
                  <div className="min-w-0">
                    SIGNED · @RILEY.HUNTS<br />
                    <span className="text-white/40 break-all">HAUNTLOG.APP/SAMPLE</span>
                  </div>
                </div>
                <Star className="w-4 h-4 md:w-5 md:h-5 text-yellow-400 shrink-0" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-gradient-to-b from-black to-zinc-950 py-12 md:py-20">
        <div className="max-w-screen-2xl mx-auto px-6 md:px-8 text-center">
          <h2 className="text-4xl md:text-6xl font-medium tracking-tighter mb-4 md:mb-6 leading-tight">Start logging<br />like a real investigator.</h2>
          <p className="text-base md:text-2xl text-white/70 mb-8 md:mb-10">{isSignedIn ? "Pick up where you left off." : "Free to sign up. Free to use."}<br />First 500 investigators get lifetime Pro tier free.</p>
          
          <Link
            to={primaryHref}
            className="inline-flex items-center justify-center gap-x-3 md:gap-x-4 bg-white text-black hover:bg-haunt-red hover:text-white text-lg md:text-2xl font-semibold px-8 md:px-16 py-5 md:py-8 rounded-2xl md:rounded-3xl transition-all active:scale-95"
          >
            <span>{isSignedIn ? 'OPEN APP' : 'CREATE ACCOUNT'}</span>
            <span className="text-2xl md:text-4xl" aria-hidden="true">🪦</span>
          </Link>
          
          <div className="mt-5 md:mt-6 text-[10px] md:text-xs text-white/40">{isSignedIn ? 'YOU\'RE ALREADY SIGNED IN' : 'NO SPAM · UNSUBSCRIBE ANYTIME'}</div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-black border-t border-white/10 py-10 md:py-16">
        <div className="max-w-screen-2xl mx-auto px-6 md:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start gap-y-10 md:gap-y-12">
            <div>
              <div className="flex items-center gap-x-2 md:gap-x-3 mb-4 md:mb-6">
                <img src="/hauntlog-mark-color.svg" alt="HauntLog" className="h-7 md:h-8" />
                <span className="font-mono text-xl md:text-2xl">HAUNTLOG</span>
              </div>
              <p className="text-white/60 max-w-xs text-sm md:text-base">The evidence vault for paranormal investigators. Built by hunters, for hunters.</p>
            </div>

            <div className="grid grid-cols-3 gap-x-8 md:gap-x-16 w-full md:w-auto">
              <div>
                <div className="font-mono text-[10px] md:text-xs text-white/40 mb-3 md:mb-4">PRODUCT</div>
                <div className="space-y-2 md:space-y-3 text-sm">
                  <div>Features</div>
                  <div>Evidence</div>
                  <div>Pricing</div>
                  <div>Waitlist</div>
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] md:text-xs text-white/40 mb-3 md:mb-4">COMMUNITY</div>
                <div className="space-y-2 md:space-y-3 text-sm">
                  <div>TikTok</div>
                  <div>Instagram</div>
                  <div>Discord</div>
                  <div>Reddit</div>
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] md:text-xs text-white/40 mb-3 md:mb-4">COMPANY</div>
                <div className="space-y-2 md:space-y-3 text-sm">
                  <div>About</div>
                  <div>Press kit</div>
                  <div>Terms</div>
                  <div>Privacy</div>
                </div>
              </div>
            </div>

            <div className="md:text-right">
              <div className="text-[10px] md:text-xs text-white/40">© 2026 HAUNTLOG · MADE FOR HUNTERS</div>
              <div className="font-mono text-xs md:text-sm mt-4 md:mt-6">HAUNTLOG.APP</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
