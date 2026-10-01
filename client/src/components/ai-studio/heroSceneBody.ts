export const SCENE_BODY = String.raw`
<g class="heroFloat">
  <rect x="162" y="37" width="128" height="146" rx="14" fill="#a98bbd" opacity=".4"/>
  <rect x="158" y="33" width="128" height="146" rx="14" fill="#c0a3c9" opacity=".55"/>
  <g filter="url(#shCard)"><rect x="155" y="30" width="128" height="146" rx="14" fill="url(#photoSky)"/></g>
  <g clip-path="url(#photoClip)">
    <rect x="155" y="30" width="128" height="146" fill="url(#photoSky)"/>
    <g opacity=".9">
      <ellipse cx="195" cy="60" rx="55" ry="42" fill="url(#sunG)"/>
      <g opacity=".22" fill="#fff">
        <rect x="160" y="40" width="80" height="2" rx="1"/>
        <rect x="160" y="48" width="80" height="2" rx="1"/>
        <rect x="160" y="56" width="80" height="2" rx="1"/>
        <rect x="160" y="64" width="80" height="2" rx="1"/>
        <rect x="160" y="72" width="80" height="2" rx="1"/>
      </g>
    </g>
    <g>
      <circle cx="260" cy="48" r="14" fill="#fff" opacity=".22" filter="url(#b2)"/>
      <circle cx="168" cy="92" r="10" fill="#fff" opacity=".25" filter="url(#b2)"/>
      <circle cx="246" cy="100" r="7" fill="#ffb098" opacity=".35" filter="url(#b2)"/>
      <circle cx="175" cy="48" r="5" fill="#fff" opacity=".4" filter="url(#b1)"/>
      <circle cx="268" cy="90" r="4" fill="#fff" opacity=".5" filter="url(#b1)"/>
      <circle cx="195" cy="35" r="3" fill="#fff" opacity=".6" filter="url(#bHalf)"/>
    </g>
    <path d="M155 110 C185 102 240 102 283 95 L283 125 L155 125Z" fill="#d08578" opacity=".32" filter="url(#b2)"/>
    <path d="M155 122 C185 114 240 116 283 108 L283 176 L155 176Z" fill="url(#tableGrad)"/>
    <path d="M155 136 C190 130 230 132 283 125 L283 176 L155 176Z" fill="#c8927b" opacity=".45"/>
    <g stroke="#8d5c4a" stroke-width=".3" opacity=".3" fill="none">
      <path d="M160 150 Q220 146 280 148"/>
      <path d="M160 158 Q220 155 280 156"/>
      <path d="M160 166 Q220 164 280 165"/>
    </g>
    <path d="M170 118 C172 134 174 148 170 176" stroke="#c99a87" stroke-width="2.5" opacity=".4" fill="none" filter="url(#b1)"/>
    <path d="M258 112 C260 130 264 150 262 176" stroke="#b47b6a" stroke-width="3" opacity=".45" fill="none" filter="url(#b1)"/>
    <path d="M198 118 C200 134 196 150 200 176" stroke="#fff" stroke-width="2.5" opacity=".45" fill="none" filter="url(#b1)"/>
    <g>
      <ellipse cx="178" cy="122" rx="14" ry="3.5" fill="#5e3a30" opacity=".4" filter="url(#b1)"/>
      <path d="M168 100 L190 100 L187 122 Q178 125 170 122Z" fill="#faf0e4"/>
      <path d="M168 100 L190 100 L189 105 L169 105Z" fill="#ead7c7"/>
      <path d="M168 100 L170 102 L170 118 L168 120Z" fill="#d6bca7" opacity=".55"/>
      <g stroke="#c9ad99" stroke-width=".5" opacity=".7">
        <line x1="172" y1="105" x2="171" y2="122"/><line x1="177" y1="105" x2="177" y2="123"/><line x1="183" y1="105" x2="184" y2="122"/>
      </g>
      <ellipse cx="179" cy="100" rx="11" ry="1.6" fill="#c9ab95"/>
      <ellipse cx="179" cy="100" rx="11" ry="1.2" fill="#faf0e4"/>
      <g>
        <ellipse cx="174" cy="94" rx="2.5" ry="5" fill="url(#leafDeep)" transform="rotate(-24 174 94)"/>
        <ellipse cx="184" cy="94" rx="2.5" ry="5" fill="url(#leafDeep)" transform="rotate(24 184 94)"/>
        <ellipse cx="179" cy="90" rx="2.2" ry="5.2" fill="url(#leafBright)"/>
        <ellipse cx="170" cy="97" rx="2" ry="3.8" fill="url(#leafDeep)" transform="rotate(-40 170 97)"/>
        <ellipse cx="188" cy="97" rx="2" ry="3.8" fill="url(#leafDeep)" transform="rotate(40 188 97)"/>
        <ellipse cx="179" cy="92" rx=".6" ry="1.5" fill="#fff" opacity=".5"/>
      </g>
    </g>
    <g>
      <g fill="url(#leafDeep)">
        <path d="M243 102 C237 78 246 55 263 42 C270 58 263 85 248 103Z"/>
        <path d="M238 106 C224 86 226 60 240 44 C248 62 246 92 238 106Z"/>
        <path d="M252 108 C258 84 274 68 290 64 C286 86 272 103 252 108Z"/>
        <path d="M224 92 C216 76 220 56 232 46 C238 62 234 82 224 92Z"/>
      </g>
      <g stroke="#1c3a1f" stroke-width=".3" opacity=".55" fill="none">
        <path d="M248 100 L261 46"/><path d="M248 100 L254 70 M248 100 L240 68"/>
        <path d="M240 102 L237 50"/><path d="M240 102 L234 72 M240 102 L246 74"/>
        <path d="M253 106 L286 68"/><path d="M253 106 L272 82 M253 106 L267 90"/>
      </g>
      <g fill="url(#leafBright)" opacity=".55">
        <path d="M248 100 C244 82 252 58 263 44 C262 60 255 82 248 100Z"/>
        <path d="M252 108 C258 90 274 72 288 68 C280 86 268 102 252 108Z"/>
      </g>
      <g fill="#fff" opacity=".2">
        <ellipse cx="258" cy="60" rx="6" ry="2.2" transform="rotate(-32 258 60)"/>
        <ellipse cx="240" cy="68" rx="5" ry="2" transform="rotate(-20 240 68)"/>
        <ellipse cx="272" cy="76" rx="5" ry="2" transform="rotate(-25 272 76)"/>
      </g>
    </g>
    <g>
      <ellipse cx="210" cy="155" rx="26" ry="6" fill="#5a2e2a" opacity=".4" filter="url(#b2)"/>
      <ellipse cx="210" cy="156" rx="18" ry="3" fill="#3a1e1e" opacity=".5" filter="url(#b1)"/>
      <path d="M190 82 Q191 73 198 71 L199 60 L220 60 L221 71 Q228 73 229 82 L232 143 Q233 155 219 157 L201 157 Q187 155 188 143Z" fill="url(#bottleMain)"/>
      <g clip-path="url(#bottleClip)">
        <rect x="186" y="60" width="48" height="40" fill="url(#bottleTopShade)"/>
        <rect x="186" y="130" width="48" height="30" fill="url(#bottleBottomShade)"/>
        <path d="M219 60 L229 82 L232 143 Q233 155 219 157 L214 157 Q222 150 221 138 L218 85Z" fill="#7a2a2b" opacity=".3"/>
        <path d="M190 82 Q195 86 210 86 Q225 86 229 82 L229 90 Q215 94 190 90Z" fill="#8d3a39" opacity=".3" filter="url(#b1)"/>
        <path d="M193 76 Q191 90 191 140 Q191 150 198 155 C194 140 194 100 199 76Z" fill="#fff" opacity=".4" filter="url(#b1)"/>
        <rect x="196" y="80" width="5" height="68" rx="2.5" fill="#fff" opacity=".55" filter="url(#b1)" class="bottleShine"/>
        <rect x="197.2" y="82" width="2" height="63" rx="1" fill="#fff" opacity=".95" class="bottleShine"/>
        <rect x="223" y="86" width="1.5" height="55" rx=".75" fill="#fff" opacity=".3" filter="url(#bHalf)"/>
        <g stroke="#8e3a37" stroke-width=".3" opacity=".3">
          <line x1="188" y1="105" x2="232" y2="105"/>
          <line x1="188" y1="120" x2="232" y2="120"/>
          <line x1="188" y1="135" x2="232" y2="135"/>
        </g>
        <g fill="#fff" opacity=".65">
          <circle cx="205" cy="98" r=".9"/><circle cx="213" cy="103" r=".7"/><circle cx="208" cy="110" r="1"/>
          <circle cx="218" cy="115" r=".6"/><circle cx="202" cy="118" r=".8"/><circle cx="211" cy="125" r=".9"/>
          <circle cx="221" cy="130" r=".55"/><circle cx="205" cy="133" r=".7"/><circle cx="215" cy="140" r=".8"/>
          <circle cx="200" cy="128" r=".55"/><circle cx="225" cy="120" r=".55"/>
        </g>
        <g>
          <rect x="194" y="105" width="32" height="30" rx="2" fill="url(#labelGrad)"/>
          <rect x="194" y="105" width="32" height="4" fill="#e2a98f" opacity=".6"/>
          <rect x="194" y="131" width="32" height="4" fill="#c38771" opacity=".55"/>
          <g transform="translate(210 120)">
            <circle r="4.2" fill="none" stroke="#8b4a3b" stroke-width=".5"/>
            <path d="M-2.4 .5 Q0 -2.8 2.4 .5 Q0 2.8 -2.4 .5Z" fill="#8b4a3b"/>
          </g>
          <rect x="196" y="113" width="10" height="1.2" rx=".6" fill="#8b4a3b" opacity=".7"/>
          <rect x="216" y="113" width="8" height="1.2" rx=".6" fill="#8b4a3b" opacity=".5"/>
          <rect x="196" y="127" width="12" height="1" rx=".5" fill="#8b4a3b" opacity=".6"/>
          <rect x="214" y="127" width="10" height="1" rx=".5" fill="#8b4a3b" opacity=".5"/>
        </g>
        <path d="M188 143 Q190 155 201 157 L219 157 Q233 155 232 143 L232 150 Q230 158 215 158 L205 158 Q190 157 188 150Z" fill="#4a1d1d" opacity=".35"/>
      </g>
      <g>
        <rect x="197" y="52" width="26" height="12" rx="3" fill="url(#capGrad)"/>
        <rect x="197" y="52" width="26" height="12" rx="3" fill="url(#capTopGrad)" opacity=".65"/>
        <g stroke="#8d4a44" stroke-width=".5" opacity=".55">
          <line x1="200" y1="54" x2="200" y2="62"/><line x1="203" y1="54" x2="203" y2="62"/>
          <line x1="206" y1="54" x2="206" y2="62"/><line x1="209" y1="54" x2="209" y2="62"/>
          <line x1="212" y1="54" x2="212" y2="62"/><line x1="215" y1="54" x2="215" y2="62"/>
          <line x1="218" y1="54" x2="218" y2="62"/><line x1="221" y1="54" x2="221" y2="62"/>
        </g>
        <rect x="197" y="60" width="26" height="2" fill="#5c2a26" opacity=".4"/>
        <ellipse cx="210" cy="52" rx="13" ry="3.5" fill="#ffe6d9"/>
        <ellipse cx="210" cy="52" rx="13" ry="3.5" fill="url(#capTopGrad)" opacity=".4"/>
        <ellipse cx="210" cy="52" rx="9" ry="2" fill="#c87d72" opacity=".5"/>
        <ellipse cx="208" cy="51" rx="4" ry=".8" fill="#fff" opacity=".55"/>
      </g>
      <path d="M199 60 L220 60 L220 63 Q210 65 199 63Z" fill="#fff" opacity=".4"/>
    </g>
    <g>
      <path d="M196 140 Q208 134 222 130" stroke="#355a2e" stroke-width=".8" fill="none"/>
      <g fill="url(#leafBright)">
        <ellipse cx="198" cy="138" rx="5" ry="2.3" transform="rotate(-25 198 138)"/>
        <ellipse cx="208" cy="140" rx="5" ry="2.3" transform="rotate(18 208 140)"/>
        <ellipse cx="203" cy="143" rx="4.6" ry="2" transform="rotate(-8 203 143)"/>
        <ellipse cx="216" cy="135" rx="4.4" ry="1.9" transform="rotate(28 216 135)"/>
        <ellipse cx="221" cy="131" rx="4" ry="1.7" transform="rotate(35 221 131)"/>
      </g>
    </g>
    <rect x="155" y="30" width="30" height="146" fill="url(#cardSheen)" opacity=".6" class="cardSweep4"/>
    <path d="M155 30 H283 V58 C240 50 190 50 155 58Z" fill="#fff" opacity=".28"/>
    <path d="M155 160 H283 V176 C240 170 190 170 155 176Z" fill="#000" opacity=".08"/>
  </g>
  <rect x="155" y="30" width="128" height="146" rx="14" fill="none" stroke="#fff" stroke-width="1.3" opacity=".75"/>
</g>
<g class="floatA"><g transform="translate(22 48)">
  <rect x="2" y="7" width="126" height="52" rx="11" fill="url(#cardEdge)"/>
  <g filter="url(#shCard)"><rect width="126" height="52" rx="11" fill="url(#cardFace)"/></g>
  <path d="M0 0 H126 V20 C92 13 42 13 0 20Z" fill="url(#cardGloss)" opacity=".85"/>
  <rect y="0" width="126" height="52" rx="11" fill="url(#cardSheen)" opacity=".35" class="cardSweep"/>
  <g filter="url(#shIcon)">
    <rect x="10" y="11" width="30" height="30" rx="9" fill="url(#igGrad)"/>
    <rect x="10" y="11" width="30" height="30" rx="9" fill="url(#igInner)"/>
    <rect x="15" y="16" width="20" height="20" rx="6" fill="none" stroke="#fff" stroke-width="2"/>
    <circle cx="25" cy="26" r="4.5" fill="none" stroke="#fff" stroke-width="2"/>
    <circle cx="31.5" cy="19.5" r="1.5" fill="#fff"/>
  </g>
  <text x="46" y="23" font-size="11" font-weight="800" fill="#171e37">Instagram</text>
  <text x="46" y="35" font-size="7.5" font-weight="500" fill="#8a93a8">Caption + Image</text>
  <g transform="translate(110 25)"><circle r="7" fill="#f3eaff"/><path d="M-1.5 -2.5 L1.8 0 L-1.5 2.5" fill="none" stroke="url(#arrowGrad)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>
</g></g>
<g class="floatB"><g transform="translate(298 46)">
  <rect x="2" y="7" width="126" height="52" rx="11" fill="url(#cardEdge)"/>
  <g filter="url(#shCard)"><rect width="126" height="52" rx="11" fill="url(#cardFace)"/></g>
  <path d="M0 0 H126 V20 C92 13 42 13 0 20Z" fill="url(#cardGloss)" opacity=".85"/>
  <rect y="0" width="126" height="52" rx="11" fill="url(#cardSheen)" opacity=".35" class="cardSweep2"/>
  <g filter="url(#shIcon)">
    <rect x="10" y="11" width="30" height="30" rx="9" fill="url(#waGrad)"/>
    <rect x="10" y="11" width="30" height="30" rx="9" fill="url(#igInner)"/>
    <path d="M25 17 c-5 0 -9 4 -9 8.8 c0 1.6 .5 3.2 1.3 4.5 l-1.2 4.4 l4.6 -1.2 c1.3 .7 2.8 1.1 4.3 1.1 c5 0 9 -4 9 -8.8 s-4 -8.8 -9 -8.8z" fill="#fff"/>
    <path d="M20.5 23 c0 4 3.5 7.5 7.5 7.5 c.5 0 1 -.4 1 -.9 l.1 -1.4 c.1 -.5 -.3 -.9 -.8 -1 l-1.3 -.3 c-.4 -.1 -.9 .1 -1.1 .5 l-.4 .6 c-1.1 -.5 -2 -1.4 -2.5 -2.5 l.6 -.4 c.4 -.3 .5 -.7 .4 -1.1 l-.3 -1.3 c-.1 -.5 -.5 -.9 -1 -.8 l-1.4 .1 c-.5 0 -.8 .5 -.8 1z" fill="url(#waGrad)"/>
  </g>
  <text x="46" y="23" font-size="11" font-weight="800" fill="#171e37">WhatsApp</text>
  <text x="46" y="35" font-size="7.5" font-weight="500" fill="#8a93a8">Template copy</text>
  <g transform="translate(110 25)"><circle r="7" fill="#f3eaff"/><path d="M-1.5 -2.5 L1.8 0 L-1.5 2.5" fill="none" stroke="url(#arrowGrad)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>
</g></g>
<g class="floatD"><g transform="translate(18 128)">
  <rect x="2" y="7" width="138" height="50" rx="11" fill="url(#cardEdge)"/>
  <g filter="url(#shCard)"><rect width="138" height="50" rx="11" fill="url(#cardFace)"/></g>
  <path d="M0 0 H138 V18 C100 12 42 12 0 18Z" fill="url(#cardGloss)" opacity=".85"/>
  <rect y="0" width="138" height="50" rx="11" fill="url(#cardSheen)" opacity=".35" class="cardSweep3"/>
  <g filter="url(#shIcon)">
    <rect x="10" y="11" width="28" height="26" rx="6" fill="url(#mailGrad)"/>
    <rect x="13" y="18" width="22" height="15" rx="2" fill="#fff"/>
    <path d="M13 18 L24 27 L35 18" fill="none" stroke="#c42030" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="34" cy="14" r="2.5" fill="#ffd451" stroke="#fff" stroke-width=".8"/>
  </g>
  <text x="46" y="24" font-size="11" font-weight="800" fill="#171e37">Email</text>
  <text x="46" y="36" font-size="7.5" font-weight="500" fill="#8a93a8">Subject + Message</text>
  <g transform="translate(122 25)"><circle r="7" fill="#f3eaff"/><path d="M-1.5 -2.5 L1.8 0 L-1.5 2.5" fill="none" stroke="url(#arrowGrad)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>
</g></g>
<g class="floatC"><g transform="translate(298 118)">
  <rect x="2" y="7" width="130" height="52" rx="11" fill="url(#cardEdge)"/>
  <g filter="url(#shCard)"><rect width="130" height="52" rx="11" fill="url(#cardFace)"/></g>
  <path d="M0 0 H130 V20 C92 13 42 13 0 20Z" fill="url(#cardGloss)" opacity=".85"/>
  <rect y="0" width="130" height="52" rx="11" fill="url(#cardSheen)" opacity=".35" class="cardSweep4"/>
  <g filter="url(#shIcon)">
    <circle cx="25" cy="26" r="15" fill="url(#fbGrad)"/>
    <circle cx="25" cy="26" r="15" fill="url(#igInner)"/>
    <path d="M29 34 v-7 h2.4 l.4 -3 h-2.8 v-1.9 c0 -.9 .3 -1.5 1.6 -1.5 h1.3 v-2.7 c-.3 0 -1.2 -.1 -2.1 -.1 c-2.2 0 -3.6 1.3 -3.6 3.7 v2.5 h-2.5 v3 h2.5 v7z" fill="#fff"/>
  </g>
  <text x="46" y="24" font-size="11" font-weight="800" fill="#171e37">Facebook</text>
  <text x="46" y="36" font-size="7.5" font-weight="500" fill="#8a93a8">Post copy</text>
  <g transform="translate(115 25)"><circle r="7" fill="#f3eaff"/><path d="M-1.5 -2.5 L1.8 0 L-1.5 2.5" fill="none" stroke="url(#arrowGrad)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>
</g></g>
<g class="heroFloat"><g transform="translate(170 150)">
  <rect x="3" y="7" width="88" height="76" rx="10" fill="url(#cardEdge)"/>
  <g filter="url(#shCard)"><rect width="88" height="76" rx="10" fill="url(#cardFace)"/></g>
  <path d="M0 0 H88 V24 C60 17 20 17 0 24Z" fill="url(#cardGloss)" opacity=".9"/>
  <text x="12" y="22" font-size="12" font-weight="900" fill="#101733">Stay</text>
  <text x="12" y="36" font-size="12" font-weight="900" fill="#101733">Hydrated</text>
  <text x="12" y="50" font-size="11" font-weight="900" fill="#101733">Stay Healthy</text>
  <rect x="12" y="56" width="36" height="1.5" rx=".7" fill="#e4def2"/>
  <g transform="translate(16 66)"><circle r="5.5" fill="#1e2847"/><path d="M-3 1 L-1 3 L3 -2" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></g>
  <text x="26" y="68" font-size="6.5" font-weight="700" fill="#3a4260">@samyuqi</text>
</g></g>
<g fill="none" stroke="url(#arrowGrad)" stroke-width="1.5" stroke-linecap="round">
  <path d="M280 190 C300 196 316 190 318 170"/>
  <path d="M312 174 L318 168 L324 173"/>
</g>
<g class="twA" transform="translate(286 36)"><use href="#sparkle8" width="18" height="18" x="-9" y="-9" fill="#ff2e7a"/></g>
<g class="twB" transform="translate(8 100)"><use href="#sparkle8" width="12" height="12" x="-6" y="-6" fill="#ff9d1a"/></g>
<g class="twC" transform="translate(420 130)"><use href="#sparkle8" width="13" height="13" x="-6.5" y="-6.5" fill="#ffb020"/></g>
<g class="twD" transform="translate(100 212)"><use href="#sparkle8" width="14" height="14" x="-7" y="-7" fill="#3a8bff"/></g>
<g class="twE" transform="translate(110 220)"><use href="#sparkle8" width="7" height="7" x="-3.5" y="-3.5" fill="#ffb020"/></g>
<g class="twB" transform="translate(430 68)"><use href="#sparkle8" width="7" height="7" x="-3.5" y="-3.5" fill="#c48bff"/></g>
<g class="twC" transform="translate(20 60)"><use href="#sparkle8" width="6" height="6" x="-3" y="-3" fill="#ff85c0"/></g>
<g class="twA" transform="translate(45 220)"><use href="#sparkle8" width="6" height="6" x="-3" y="-3" fill="#ffaa50"/></g>
<g class="twD" transform="translate(400 20)"><use href="#sparkle8" width="7" height="7" x="-3.5" y="-3.5" fill="#ff6a9c"/></g>
<g transform="translate(219 103)" opacity=".4">
  <circle class="ringPulse" r="4" fill="none" stroke="#c9a9ff" stroke-width=".8"/>
  <circle class="ringPulse2" r="4" fill="none" stroke="#ff9ec4" stroke-width=".8"/>
</g>
<g>
  <circle cx="75" cy="38" r="1.4" fill="#8e6de8" class="glowPulse"/>
  <circle cx="410" cy="58" r="1.3" fill="#ff8ab8" class="glowPulse"/>
  <circle cx="270" cy="100" r="1.1" fill="#8e6de8" class="glowPulse"/>
  <circle cx="42" cy="146" r="1.1" fill="#c9a9ff" class="glowPulse"/>
  <circle cx="430" cy="180" r="1.2" fill="#ff8ab8" class="glowPulse"/>
</g>
`;
