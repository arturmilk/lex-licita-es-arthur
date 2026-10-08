/**
 * Retrato do Israel Evangelista. Enquanto a foto real não chega, mostra uma ilustração
 * provisória (homem branco, de barba e óculos, de terno) — de propósito ilustrada, e não
 * foto, para ninguém tomar por uma imagem verdadeira dele. Para trocar: passe `foto`
 * (ex.: "/curso/israel.jpg", arquivo em /public).
 */
export function Retrato({ foto, className = "" }: { foto?: string; className?: string }) {
  if (foto) {
    return <img src={foto} alt="Israel Evangelista" className={`object-cover object-top ${className}`} />;
  }

  const pele = "#F0CFB7";
  const sombra = "#E1B599";
  const pelo = "#35271F";
  const armacao = "#16202B";

  return (
    <svg
      viewBox="0 0 400 500"
      preserveAspectRatio="xMidYMax meet"
      role="img"
      aria-label="Ilustração provisória de Israel Evangelista"
      className={className}
    >
      {/* terno */}
      <path d="M22 500 C 30 424 92 386 158 374 L 242 374 C 308 386 370 424 378 500 Z" fill="#0B2F57" />
      {/* pescoço */}
      <path d="M166 286 L166 378 C 182 398 218 398 234 378 L234 286 Z" fill={pele} />
      <path d="M166 314 C 184 336 216 336 234 314 L234 352 C 216 368 184 368 166 352 Z" fill={sombra} />
      {/* camisa, lapelas, colarinho e gravata */}
      <path d="M160 372 L200 470 L240 372 Z" fill="#FFFFFF" />
      <path d="M144 380 L162 370 L200 470 L186 500 L160 500 Z" fill="#082847" />
      <path d="M256 380 L238 370 L200 470 L214 500 L240 500 Z" fill="#082847" />
      <path d="M164 364 L200 400 L186 414 L156 382 Z" fill="#F3F5F8" />
      <path d="M236 364 L200 400 L214 414 L244 382 Z" fill="#F3F5F8" />
      <path d="M190 398 L210 398 L206 418 L194 418 Z" fill="#A8851A" />
      <path d="M194 418 L206 418 L215 470 L200 492 L185 470 Z" fill="#C9A227" />
      {/* orelhas */}
      <ellipse cx="131" cy="214" rx="13" ry="21" fill={sombra} />
      <ellipse cx="269" cy="214" rx="13" ry="21" fill={sombra} />
      {/* rosto e sombra lateral */}
      <path d="M134 196 C 134 140 162 110 200 110 C 238 110 266 140 266 196 C 266 256 240 314 200 320 C 160 314 134 256 134 196 Z" fill={pele} />
      <path d="M238 124 C 256 142 266 168 266 198 C 266 246 250 290 226 310 C 242 278 250 240 249 200 C 248 166 244 142 238 124 Z" fill={sombra} opacity="0.7" />
      {/* cabelo */}
      <path d="M130 204 C 118 138 146 84 204 82 C 264 80 290 132 270 204 C 268 178 262 156 248 142 C 234 128 212 126 194 128 C 174 130 156 126 148 138 C 138 152 134 176 130 204 Z" fill={pelo} />
      <path d="M170 100 C 194 90 232 94 254 112" stroke="#4A382E" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.8" />
      {/* barba cheia com bigode */}
      <path d="M134 206 C 139 230 151 246 167 252 C 181 246 191 244 200 246 C 209 244 219 246 233 252 C 249 246 261 230 266 206 C 266 264 240 336 200 344 C 160 336 134 264 134 206 Z" fill={pelo} />
      <path d="M152 266 C 160 292 176 314 194 322 M248 266 C 240 292 224 314 206 322" stroke="#4A382E" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6" />
      <path d="M184 276 C 192 283 208 283 216 276 C 208 272 192 272 184 276 Z" fill="#B97A68" />
      {/* sobrancelhas, olhos e nariz */}
      <path d="M150 176 C 160 168 178 168 188 174" stroke={pelo} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M212 174 C 222 168 240 168 250 176" stroke={pelo} strokeWidth="7" fill="none" strokeLinecap="round" />
      <ellipse cx="170" cy="202" rx="5" ry="5.5" fill="#1B232D" />
      <ellipse cx="230" cy="202" rx="5" ry="5.5" fill="#1B232D" />
      <path d="M201 206 C 197 220 193 229 196 235 C 199 239 205 239 209 235" stroke="#CF9E82" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* óculos */}
      <rect x="145" y="184" width="50" height="36" rx="11" fill="#FFFFFF" fillOpacity="0.16" stroke={armacao} strokeWidth="5" />
      <rect x="205" y="184" width="50" height="36" rx="11" fill="#FFFFFF" fillOpacity="0.16" stroke={armacao} strokeWidth="5" />
      <path d="M195 199 C 198 195 202 195 205 199" stroke={armacao} strokeWidth="4.5" fill="none" />
      <path d="M145 196 L132 192 M255 196 L268 192" stroke={armacao} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M153 191 L162 191 M213 191 L222 191" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
