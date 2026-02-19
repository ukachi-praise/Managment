
'use client';

import { headTeacherRemarks as predefinedHeadTeacherRemarks } from '@/lib/data';

const remarks = {
  excellent: [
    "An excellent and outstanding performance. Keep shining.",
    "You have demonstrated exceptional understanding in all subjects.",
    "A remarkable achievement. Maintain this impressive standard.",
    "You are a brilliant and hardworking pupil. Keep it up.",
    "Excellent work throughout the term. Very proud of your effort.",
    "Superb performance. Continue aiming higher.",
    "You have shown great confidence and mastery of your lessons.",
    "An outstanding result. Keep striving for greater success.",
    "Your dedication and focus are clearly reflected in your results.",
    "A truly commendable performance. Keep leading by example."
  ],
  veryGood: [
    "A very good performance. Keep working towards excellence.",
    "You have done very well this term. Keep it up.",
    "Strong academic performance. Continue to push yourself.",
    "Very impressive effort in most subjects.",
    "You are progressing excellently. Maintain the momentum.",
    "A commendable result. Aim even higher next term.",
    "Good consistency and understanding shown.",
    "You are doing very well. Stay focused and determined.",
    "A strong performance with great potential for improvement.",
    "Keep working hard to reach the top level."
  ],
  good: [
    "A good result. More effort will lead to greater success.",
    "You are doing well. Continue to work harder.",
    "Steady progress observed. Keep improving.",
    "A promising performance. Stay focused.",
    "You have shown good understanding in most subjects.",
    "Keep practicing to improve your overall performance.",
    "A satisfactory result. Aim for higher grades next term.",
    "You are capable of doing better with more effort.",
    "Continue to build on your strengths.",
    "Good progress, but there is room for improvement."
  ],
  fair: [
    "A fair performance. Greater effort is required.",
    "You need to be more focused in your studies.",
    "Improvement is needed in several subjects.",
    "You can do better with more dedication.",
    "A creditable performance. Work harder next term.",
    "More seriousness and practice are required.",
    "You have potential but must apply yourself more.",
    "Fair result. Increase your effort and concentration.",
    "Seek help where necessary to improve.",
    "Put in more effort to achieve better results."
  ]
};

export function generateRemark(score: number): string {
  let group;

  if (score >= 80) group = remarks.excellent;
  else if (score >= 70) group = remarks.veryGood;
  else if (score >= 60) group = remarks.good;
  else group = remarks.fair;

  return group[Math.floor(Math.random() * group.length)];
}

export function generateHeadTeacherRemark(score: number): string {
    let group: string[];
    if (score >= 80) {
        group = predefinedHeadTeacherRemarks.filter(r => r.toLowerCase().includes('excellent') || r.toLowerCase().includes('outstanding') || r.toLowerCase().includes('exceptional'));
    } else if (score >= 70) {
        group = predefinedHeadTeacherRemarks.filter(r => r.toLowerCase().includes('very good') || r.toLowerCase().includes('consistent') || r.toLowerCase().includes('potential'));
    } else if (score >= 60) {
        group = predefinedHeadTeacherRemarks.filter(r => r.toLowerCase().includes('good') || r.toLowerCase().includes('satisfactory'));
    } else {
        group = predefinedHeadTeacherRemarks.filter(r => r.toLowerCase().includes('improvement') || r.toLowerCase().includes('attention') || r.toLowerCase().includes('better'));
    }
     if (group.length === 0) {
        // Fallback to a generic remark if no specific ones match
        if (score >= 70) return "A commendable effort this term.";
        if (score >= 50) return "Satisfactory progress has been made.";
        return "Significant improvement is required.";
    }

    return group[Math.floor(Math.random() * group.length)];
}
