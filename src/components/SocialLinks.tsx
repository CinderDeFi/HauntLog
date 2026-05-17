import {
  Globe,
  Instagram,
  Facebook,
  Youtube,
} from 'lucide-react';
import { socialLabel } from '../lib/socials';

// TikTok isn't in lucide; we use an inline SVG to match the look.
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.85a8.16 8.16 0 0 0 4.77 1.52V6.92a4.85 4.85 0 0 1-1.84-.23z" />
    </svg>
  );
}

export type SocialLinksValue = {
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  youtube: string | null;
};

type Props = {
  value: Partial<SocialLinksValue>;
  /**
   * Compact = icons only (for team/profile headers).
   * Full = icon + label, vertical (for management pages).
   */
  variant?: 'compact' | 'full';
};

export default function SocialLinks({ value, variant = 'compact' }: Props) {
  const links: Array<{
    key: keyof SocialLinksValue;
    url: string;
    icon: React.ReactNode;
    name: string;
  }> = [];

  if (value.website)
    links.push({
      key: 'website',
      url: value.website,
      icon: <Globe className="w-4 h-4" />,
      name: 'Website',
    });
  if (value.instagram)
    links.push({
      key: 'instagram',
      url: value.instagram,
      icon: <Instagram className="w-4 h-4" />,
      name: 'Instagram',
    });
  if (value.tiktok)
    links.push({
      key: 'tiktok',
      url: value.tiktok,
      icon: <TikTokIcon className="w-4 h-4" />,
      name: 'TikTok',
    });
  if (value.facebook)
    links.push({
      key: 'facebook',
      url: value.facebook,
      icon: <Facebook className="w-4 h-4" />,
      name: 'Facebook',
    });
  if (value.youtube)
    links.push({
      key: 'youtube',
      url: value.youtube,
      icon: <Youtube className="w-4 h-4" />,
      name: 'YouTube',
    });

  if (links.length === 0) return null;

  if (variant === 'compact') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {links.map((l) => (
          <a
            key={l.key}
            href={l.url}
            target="_blank"
            rel="noreferrer"
            title={l.name}
            className="w-9 h-9 inline-flex items-center justify-center bg-white/5 hover:bg-haunt-red/20 hover:text-haunt-red border border-white/10 rounded-xl text-white/70 transition-colors"
          >
            {l.icon}
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {links.map((l) => (
        <a
          key={l.key}
          href={l.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-x-3 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 hover:border-white/30 transition-colors"
        >
          <span className="text-white/60">{l.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-mono text-white/40 tracking-widest">
              {l.name.toUpperCase()}
            </div>
            <div className="text-sm truncate">
              {socialLabel(l.key === 'website' ? 'website' : l.key, l.url)}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
