// src/pages/Landing.tsx
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Zap, Radio, Thermometer, Mic, Volume2, Star } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* HEADER */}
      <header className="border-b border-white/10">
        <div className="max-w-screen-2xl mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-x-3">
            <img 
              src="/hauntlog-mark-color.svg" 
              alt="HauntLog" 
              className="h-9 w-9" 
            />
            <span className="font-mono text-3xl tracking-[-2px] text-white">HAUNTLOG</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-x-8 text-sm font-medium">
            <a href="#features" className="hover:text-haunt-red transition-colors">FEATURES</a>
            <a href="#evidence" className="hover:text-haunt-red transition-colors">EVIDENCE</a>
            <a href="#venues" className="hover:text-haunt-red transition-colors">LOCATIONS</a>
            <a href="#pricing" className="hover:text-haunt-red transition-colors">PRICING</a>
          </nav>

          <Link 
            to="/app" 
            className="px-8 py-3.5 bg-white text-black rounded-2xl font-semibold hover:bg-haunt-red hover:text-white transition-all active:scale-95"
          >
            JOIN WAITLIST
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-screen-2xl mx-auto px-8 pt-20 pb-16">
        <div className="flex flex-col lg:flex-row gap-12 items-center">
          <div className="flex-1">
            <div className="inline-flex items-center gap-x-3 bg-white/10 rounded-3xl px-6 py-3 text-sm mb-8">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </div>
              NOW ACCEPTING EARLY HUNTERS
            </div>
            
            <h1 className="text-7xl lg:text-8xl font-medium leading-none tracking-[-3px] mb-6">
              The haunt is<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-haunt-red">unrecorded.</span><br />
              Logged.
            </h1>
            
            <p className="max-w-lg text-2xl text-white/70 leading-tight mb-10">
              A real evidence vault for paranormal investigators. Log your K-II hits, REM pod alerts, and SB7 captures with timestamp precision.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <Link to="/app">
                <Button className="bg-haunt-red hover:bg-red-600 text-white px-10 py-6 text-xl rounded-3xl flex items-center gap-x-3">
                  JOIN WAITLIST
                  <span className="text-2xl">→</span>
                </Button>
              </Link>
              
              <a 
                href="#how" 
                className="px-10 py-6 border border-white/30 hover:border-white/60 rounded-3xl text-xl font-medium flex items-center gap-x-3 transition-colors"
              >
                HOW IT WORKS
              </a>
            </div>

            {/* Trust line */}
            <div className="mt-16 flex items-center gap-x-8 text-sm text-white/60">
              <div className="flex -space-x-4">
                <div className="w-8 h-8 bg-white/10 backdrop-blur rounded-2xl border border-white/30 flex items-center justify-center text-xs">K</div>
                <div className="w-8 h-8 bg-white/10 backdrop-blur rounded-2xl border border-white/30 flex items-center justify-center text-xs">R</div>
                <div className="w-8 h-8 bg-white/10 backdrop-blur rounded-2xl border border-white/30 flex items-center justify-center text-xs">S</div>
              </div>
              <div>Trusted by 200+ hunters at<br />Samuel Miller Mansion, Fort Mifflin &amp; more</div>
            </div>
          </div>

          {/* Hero visual */}
          <div className="flex-1 relative">
            <div className="aspect-square bg-gradient-to-br from-zinc-900 to-black rounded-[4rem] border border-white/10 p-8 shadow-2xl">
              <img 
                src="/hauntlog-app-icon-1024.svg" 
                alt="HauntLog App" 
                className="w-full h-full object-contain drop-shadow-2xl" 
              />
            </div>
            {/* Floating badge */}
            <div className="absolute -top-6 -right-6 bg-white text-black text-xs font-mono px-6 py-3 rounded-3xl shadow-xl flex items-center gap-x-2 rotate-12">
              <span className="text-green-500">●</span>
              LIVE HUNT ACTIVE
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="bg-zinc-900 py-8 border-y border-white/10">
        <div className="max-w-screen-2xl mx-auto px-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-5xl font-mono text-haunt-red">5</div>
            <div className="text-white/60 text-sm tracking-widest mt-1">DEVICE TYPES</div>
            <div className="flex justify-center gap-x-4 mt-4">
              <Zap className="w-5 h-5" />
              <Radio className="w-5 h-5" />
              <Thermometer className="w-5 h-5" />
              <Mic className="w-5 h-5" />
              <Volume2 className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-5xl font-mono text-haunt-red">12hr</div>
            <div className="text-white/60 text-sm tracking-widest mt-1">PARTNER LOCATIONS</div>
          </div>
          <div>
            <div className="text-5xl font-mono text-haunt-red">∞</div>
            <div className="text-white/60 text-sm tracking-widest mt-1">CASE FILES</div>
          </div>
          <div>
            <div className="text-5xl font-mono text-haunt-red">2026</div>
            <div className="text-white/60 text-sm tracking-widest mt-1">LAUNCH YEAR</div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section id="evidence" className="max-w-screen-2xl mx-auto px-8 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <div className="uppercase text-xs tracking-[2px] text-haunt-red mb-4">— THE PROBLEM —</div>
          <h2 className="text-5xl font-medium leading-tight">
            Every ghost-hunting app on your phone is faking the readings.<br />
            <span className="text-white/70">You bought a K-II. You bought a REM pod. You hauled an SB7 to a 200-year-old mansion.</span><br />
            Why is your phone pretending to do their job?
          </h2>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="bg-zinc-950 py-20">
        <div className="max-w-screen-2xl mx-auto px-8">
          <div className="text-center mb-16">
            <div className="inline px-5 py-2 bg-white/10 text-white/80 rounded-3xl text-sm font-medium">// FEATURES</div>
            <h2 className="text-5xl font-medium mt-4">Your gear is real.<br />Your evidence should be too.</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-black border border-white/10 rounded-3xl p-8 hover:border-haunt-red/50 transition-all group">
              <div className="flex items-center gap-x-4 mb-6">
                <div className="w-12 h-12 bg-red-500/10 text-haunt-red rounded-2xl flex items-center justify-center text-2xl">01</div>
                <div>
                  <div className="font-mono text-xl">KIT</div>
                  <div className="text-white/60 text-sm">Log from your actual gear</div>
                </div>
              </div>
              <p className="text-white/70 mb-8">Tap your K-II reading the moment it spikes. Log a REM pod burst, a thermal drop, an SB7 word capture, all with one-second precision.</p>
              <div className="flex gap-x-6 text-sm font-mono text-white/70">
                <div>K-II</div>
                <div>REM POD</div>
                <div>THERMAL</div>
                <div>SB7</div>
                <div>H4n</div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="bg-black border border-white/10 rounded-3xl p-8 hover:border-haunt-red/50 transition-all group">
              <div className="flex items-center gap-x-4 mb-6">
                <div className="w-12 h-12 bg-red-500/10 text-haunt-red rounded-2xl flex items-center justify-center text-2xl">02</div>
                <div>
                  <div className="font-mono text-xl">CASES</div>
                  <div className="text-white/60 text-sm">Cinematic case files</div>
                </div>
              </div>
              <p className="text-white/70 mb-8">Every hunt becomes a sealed dossier with location, zone, equipment used, and chronological event log. Export to PDF or share via vanity URL.</p>
              <div className="text-sm font-mono uppercase text-haunt-red">SEALED · TIMESTAMPED · EXPORTABLE</div>
            </div>

            {/* Feature 3 */}
            <div className="bg-black border border-white/10 rounded-3xl p-8 hover:border-haunt-red/50 transition-all group">
              <div className="flex items-center gap-x-4 mb-6">
                <div className="w-12 h-12 bg-red-500/10 text-haunt-red rounded-2xl flex items-center justify-center text-2xl">03</div>
                <div>
                  <div className="font-mono text-xl">ATLAS</div>
                  <div className="text-white/60 text-sm">The haunted atlas</div>
                </div>
              </div>
              <p className="text-white/70 mb-8">Discover locations. See who's hunting tonight. Cross-reference your evidence with hunters at the same place, same minute.</p>
              <div className="text-sm font-mono">847 LOCATIONS · GROWING WEEKLY</div>
            </div>

            {/* Feature 4 */}
            <div className="bg-black border border-white/10 rounded-3xl p-8 hover:border-haunt-red/50 transition-all group">
              <div className="flex items-center gap-x-4 mb-6">
                <div className="w-12 h-12 bg-red-500/10 text-haunt-red rounded-2xl flex items-center justify-center text-2xl">04</div>
                <div>
                  <div className="font-mono text-xl">TEAMS</div>
                  <div className="text-white/60 text-sm">Brand every hunt</div>
                </div>
              </div>
              <p className="text-white/70">Add your team logo, your channel, your handle. Every case file gets your watermark — and a TikTok-ready highlight reel.</p>
            </div>

            {/* Feature 5 */}
            <div className="bg-black border border-white/10 rounded-3xl p-8 hover:border-haunt-red/50 transition-all group">
              <div className="flex items-center gap-x-4 mb-6">
                <div className="w-12 h-12 bg-red-500/10 text-haunt-red rounded-2xl flex items-center justify-center text-2xl">05</div>
                <div>
                  <div className="font-mono text-xl">LOCATIONS</div>
                  <div className="text-white/60 text-sm">Book directly with partner locations</div>
                </div>
              </div>
              <p className="text-white/70 mb-6">Real haunted locations. Verified by us, owned by them. Private overnight bookings.</p>
              <div className="text-xs font-medium">FEATURING: SAMUEL MILLER MANSION</div>
            </div>

            {/* Feature 6 */}
            <div className="bg-black border border-white/10 rounded-3xl p-8 hover:border-haunt-red/50 transition-all group">
              <div className="flex items-center gap-x-4 mb-6">
                <div className="w-12 h-12 bg-red-500/10 text-haunt-red rounded-2xl flex items-center justify-center text-2xl">06</div>
                <div>
                  <div className="font-mono text-xl">COMMUNITY</div>
                  <div className="text-white/60 text-sm">Vote, verify, build trust</div>
                </div>
              </div>
              <p className="text-white/70">The community decides what's real. Verdict votes, verified hunter badges, class ratings from I to V.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SAMPLE CASE */}
      <section className="max-w-screen-2xl mx-auto px-8 py-20 border-t border-b border-white/10" id="sample">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-12 items-center">
            <div className="flex-1">
              <div className="uppercase text-xs tracking-widest text-haunt-red mb-3">// SAMPLE CASE</div>
              <h2 className="text-5xl font-medium mb-6">Real events.<br />Real time stamps.</h2>
              <p className="text-white/70 max-w-md">No fake spikes. No simulated voices. Just the moments your gear actually reacted — all locked into a sealed file the community can vote on.</p>
              
              <Link to="/case/X4M-PT9" className="inline-flex mt-8 items-center gap-x-3 text-haunt-red hover:text-red-400">
                SEE THE FULL APP
                <span className="text-3xl leading-none">→</span>
              </Link>
            </div>

            {/* Sample case card - exact replica */}
            <div className="flex-1 bg-zinc-900 border border-white/10 rounded-3xl p-8 max-w-lg">
              <div className="flex justify-between items-center mb-6">
                <div className="font-mono text-sm bg-white/10 px-4 py-1 rounded-2xl">CASE FILE · SEALED</div>
                <div className="text-xs text-white/40">#X4M-PT9</div>
              </div>
              
              <div className="flex items-baseline gap-x-3 mb-4">
                <span className="text-5xl">★</span>
                <span className="text-4xl font-medium">CLASS III</span>
              </div>
              <h3 className="text-3xl font-medium">The whispering tenant</h3>
              <p className="text-white/60">OLD LYON THEATRE · STAGE LEFT · MAY 15</p>

              <div className="mt-8 space-y-6">
                <div className="flex gap-x-4">
                  <div className="w-20 font-mono text-xs text-white/40">02:14</div>
                  <div className="flex-1">
                    <span className="px-3 py-1 bg-purple-500/10 text-purple-400 text-xs rounded-xl">SB7</span>
                    <span className="ml-4">"don't leave"</span>
                  </div>
                </div>
                <div className="flex gap-x-4">
                  <div className="w-20 font-mono text-xs text-white/40">02:14</div>
                  <div className="flex-1">
                    <span className="px-3 py-1 bg-red-500/10 text-red-400 text-xs rounded-xl">K-II</span>
                    <span className="ml-4">spike to 4 (red)</span>
                  </div>
                </div>
                <div className="flex gap-x-4">
                  <div className="w-20 font-mono text-xs text-white/40">23:08</div>
                  <div className="flex-1">
                    <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 text-xs rounded-xl">THERMAL</span>
                    <span className="ml-4">drop -14°F</span>
                  </div>
                </div>
              </div>

              <div className="mt-12 flex items-center justify-between text-xs font-mono border-t pt-8 border-white/10">
                <div className="flex items-center gap-x-2">
                  <div className="w-6 h-6 bg-white/10 rounded-2xl flex items-center justify-center text-xs">RH</div>
                  <div>
                    SIGNED · @RILEY.HUNTS<br />
                    <span className="text-white/40">HAUNTLOG.APP/X4M-PT9</span>
                  </div>
                </div>
                <Star className="w-5 h-5 text-yellow-400" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-gradient-to-b from-black to-zinc-950 py-20">
        <div className="max-w-screen-2xl mx-auto px-8 text-center">
          <h2 className="text-6xl font-medium tracking-tighter mb-6">Start logging<br />like a real investigator.</h2>
          <p className="text-2xl text-white/70 mb-10">Join the waitlist for early access.<br />First 500 hunters get lifetime Pro tier free.</p>
          
          <Link to="/app">
            <Button className="bg-white text-black hover:bg-haunt-red hover:text-white text-2xl px-16 py-8 rounded-3xl inline-flex items-center gap-x-4">
              JOIN THE WAITLIST
              <span className="text-4xl">🪦</span>
            </Button>
          </Link>
          
          <div className="mt-6 text-xs text-white/40">NO SPAM · UNSUBSCRIBE ANYTIME</div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-black border-t border-white/10 py-16">
        <div className="max-w-screen-2xl mx-auto px-8">
          <div className="flex flex-col md:flex-row justify-between items-start gap-y-12">
            <div>
              <div className="flex items-center gap-x-3 mb-6">
                <img src="/hauntlog-mark-color.svg" alt="HauntLog" className="h-8" />
                <span className="font-mono text-2xl">HAUNTLOG</span>
              </div>
              <p className="text-white/60 max-w-xs">The evidence vault for paranormal investigators. Built by hunters, for hunters.</p>
            </div>

            <div className="grid grid-cols-3 gap-x-16">
              <div>
                <div className="font-mono text-xs text-white/40 mb-4">PRODUCT</div>
                <div className="space-y-3 text-sm">
                  <div>Features</div>
                  <div>Evidence</div>
                  <div>Pricing</div>
                  <div>Waitlist</div>
                </div>
              </div>
              <div>
                <div className="font-mono text-xs text-white/40 mb-4">COMMUNITY</div>
                <div className="space-y-3 text-sm">
                  <div>TikTok</div>
                  <div>Instagram</div>
                  <div>Discord</div>
                  <div>Reddit</div>
                </div>
              </div>
              <div>
                <div className="font-mono text-xs text-white/40 mb-4">COMPANY</div>
                <div className="space-y-3 text-sm">
                  <div>About</div>
                  <div>Press kit</div>
                  <div>Terms</div>
                  <div>Privacy</div>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-white/40">© 2026 HAUNTLOG · MADE FOR HUNTERS</div>
              <div className="font-mono text-sm mt-6">HAUNTLOG.APP</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
