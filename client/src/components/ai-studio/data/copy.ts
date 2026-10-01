import type { Language, PackContext } from "./types";

/**
 * Channel-adapted copy templates.
 * Each channel is written separately (not copy/pasted) and for 3 languages.
 */

const OCC_HI: Record<string, string> = { Diwali: "दिवाली", Festive: "फेस्टिव" };

interface Words {
  occ: string; // Diwali | Festive | ""
  occLocal: string;
  pct: number | null;
  place: string | null;
}

function words(ctx: PackContext, lang: Language): Words {
  const occ = ctx.occasion ?? "";
  return {
    occ,
    occLocal: lang === "Hindi" ? OCC_HI[occ] ?? occ : occ,
    pct: ctx.pct,
    place: ctx.place,
  };
}

export interface ChannelCopy {
  caption: string;
  hashtags: string;
  waBody: string;
  waFooter: string;
  waButtons: [string, string];
  waExample: string;
  emailSubject: string;
  emailBody: string;
}

export function buildCopy(ctx: PackContext, lang: Language, variant: number): ChannelCopy {
  const w = words(ctx, lang);
  const v = variant % 2;
  const place = w.place;

  const tags = [
    w.occ ? `#${w.occ}Offer` : "#SpecialOffer",
    "#Skincare",
    place ? `#${place}` : "#ShopLocal",
    w.occ ? "#FestivalGlow" : "#GlowUp",
    "#HealthySkin",
    "#Samyoj",
  ].join(" ");

  if (lang === "Hindi") {
    const title = w.occ ? `${w.occLocal} स्पेशल ऑफर` : "स्पेशल ऑफर";
    const store = place ? `हमारे ${place} स्टोर` : "हमारे स्टोर";
    const off = w.pct ? `फ्लैट ${w.pct}% की छूट` : "खास ऑफर";
    return {
      caption: `${v ? "🪔" : "✨"} ${title}! ${v ? "🪔" : "✨"}\n\n${store} पर सभी प्रीमियम स्किनकेयर प्रोडक्ट्स पर पाएं ${off}! 🎁\n\n${w.occ ? "रोशनी के इस त्योहार पर अपनी त्वचा को दें प्राकृतिक चमक।" : "प्राकृतिक चमक के लिए सही समय।"} प्राकृतिक सामग्री, असली नतीजे। अपनों के लिए बेहतरीन तोहफ़े। ❤️\n\n📍 इस वीकेंड ${store} ज़रूर आएं!`,
      hashtags: tags,
      waBody: `नमस्ते {{1}}, ✨ ${title} ✨\n\nप्रीमियम स्किनकेयर रेंज पर ${w.pct ? w.pct + "% की छूट" : "खास कीमतें"} पाएं।\n\nऑफर सिर्फ़ इस वीकेंड तक। स्टोर देखने या प्रोडक्ट्स ब्राउज़ करने के लिए नीचे टैप करें।`,
      waFooter: "सीमित समय का ऑफर। शर्तें लागू।",
      waButtons: ["स्टोर देखें", "प्रोडक्ट्स देखें"],
      waExample: "प्रिया",
      emailSubject: `${title} — ${w.pct ? `फ्लैट ${w.pct}% की छूट` : "खास बचत"}${place ? `, ${place} स्टोर पर` : ""} 🎁`,
      emailBody: `नमस्ते {{name}},\n\n${w.occ ? `इस ${w.occLocal}` : "इस सीज़न"} अपने और अपनों के लिए चुनें हमारा प्रीमियम स्किनकेयर कलेक्शन। ${w.pct ? `सभी प्रोडक्ट्स पर पाएं फ्लैट ${w.pct}% की छूट` : "सभी प्रोडक्ट्स पर पाएं खास बचत"}, इस वीकेंड ${store} पर।\n\nप्राकृतिक सामग्री, असली नतीजे और त्योहार के लिए बेहतरीन तोहफ़े।\n\n${store} आइए और इस सीज़न को और रोशन बनाइए! ✨\n\nसादर,\nSamyoj Team`,
    };
  }

  if (lang === "Hinglish") {
    const title = w.occ ? `${w.occ} Special Offer` : "Special Offer";
    const store = place ? `hamare ${place} store` : "hamare store";
    return {
      caption: `${v ? "🪔" : "✨"} ${title}! ${v ? "🪔" : "✨"}\n\n${store.charAt(0).toUpperCase() + store.slice(1)} par saare premium skincare products pe paayein ${w.pct ? `FLAT ${w.pct}% OFF` : "khaas offers"}! 🎁\n\n${w.occ ? "Roshni ke is tyohaar par apni skin ko dein natural glow." : "Natural glow ke liye perfect time."} Natural ingredients, real results. Apno ke liye perfect gifts. ❤️\n\n📍 Is weekend ${store} zaroor aayein!`,
      hashtags: tags,
      waBody: `Hi {{1}}, ✨ ${title} ✨\n\nHamari premium skincare range par ${w.pct ? w.pct + "% OFF" : "special savings"} paayein.\n\nOffer sirf is weekend tak. Store dekhne ya products browse karne ke liye neeche tap karein.`,
      waFooter: "Limited time offer. T&C apply.",
      waButtons: ["Store Dekhein", "Products Dekhein"],
      waExample: "Priya",
      emailSubject: `${title} — ${w.pct ? `Flat ${w.pct}% OFF` : "Exclusive Savings"}${place ? ` ${place} Store par` : ""} 🎁`,
      emailBody: `Hi {{name}},\n\n${w.occ ? `Is ${w.occ}` : "Is season"} apne aur apno ke liye chuniye hamara premium skincare collection. ${w.pct ? `Saare products par paayein Flat ${w.pct}% OFF` : "Saare products par paayein special savings"}, is weekend ${store} par.\n\nNatural ingredients, real results, aur festive season ke perfect gifts.\n\n${store.charAt(0).toUpperCase() + store.slice(1)} aaiye aur is season ko aur bright banaiye! ✨\n\nWarm regards,\nSamyoj Team`,
    };
  }

  // English
  const title = w.occ ? `${w.occ} Special Offer` : "Special Offer";
  const lead = w.pct ? `Get FLAT ${w.pct}% OFF on` : "Enjoy our best offers on";
  const at = place ? `at our ${place} store` : "at our store";
  const festive = w.occ === "Diwali"
    ? "Celebrate the festival of lights with healthy, glowing skin. Natural ingredients, real results. Perfect gifts for your loved ones. ❤️"
    : w.occ
      ? "Celebrate the season with healthy, glowing skin. Natural ingredients, real results. Perfect gifts for your loved ones. ❤️"
      : "Healthy, glowing skin starts with natural ingredients and real results. Treat yourself or someone you love. ❤️";
  const opener = v ? (w.occ === "Diwali" ? "🪔" : "🌿") : "✨";

  return {
    caption: `${opener} ${title}! ${opener}\n\n${lead} all our premium skincare products ${at}! 🎁\n\n${festive}\n\n📍 Visit our ${place ? place + " " : ""}store this weekend only!`,
    hashtags: tags,
    waBody: `Hi {{1}}, ✨ ${title}! ✨\n\n${w.pct ? `Enjoy ${w.pct}% OFF` : "Enjoy special savings"} on our premium skincare range ${at} this weekend.\n\nVisit us or browse our favourites before the offer ends!`,
    waFooter: "Limited time offer. T&C apply.",
    waButtons: ["Visit Store", "View Products"],
    waExample: "Priya",
    emailSubject: `${title} — ${w.pct ? `Flat ${w.pct}% OFF` : "Exclusive Savings"} at Our ${place ? place + " " : ""}Store 🎁`,
    emailBody: `Hi {{name}},\n\n${w.occ ? `This ${w.occ}` : "This season"}, treat yourself and your loved ones with our premium skincare collection. ${w.pct ? `Get Flat ${w.pct}% OFF on all products` : "Enjoy special savings on all products"} ${at} this weekend.\n\nNatural ingredients, real results, and the perfect gifts for the ${w.occ ? "festive " : ""}season.\n\nVisit our ${place ? place + " " : ""}store and make this ${w.occ || "season"} brighter! ✨\n\nWarm regards,\nSamyoj Team`,
  };
}

/** Lightweight mock of "Refine with AI" — transforms copy by instruction keywords. */
export function refineText(text: string, instruction: string): string {
  const i = instruction.toLowerCase();
  const paras = text.split("\n\n");
  if (/short|brief|concise|trim/.test(i)) {
    if (paras.length <= 3) return text;
    return [...paras.slice(0, 2), paras[paras.length - 1]].join("\n\n");
  }
  if (/premium|luxur|elegant|classy/.test(i)) {
    return text.replace(/!/g, ".").replace(/ 🎁/g, "").replace(/FLAT/g, "Flat");
  }
  if (/urgent|hurry|last|limited|deadline/.test(i)) {
    const line = "Hurry — this offer ends Sunday.";
    if (text.includes(line)) return text;
    return [...paras.slice(0, -1), line, paras[paras.length - 1]].join("\n\n");
  }
  const line = "We can't wait to welcome you. 💛";
  if (text.includes(line)) return text;
  return [...paras.slice(0, -1), line, paras[paras.length - 1]].join("\n\n");
}
