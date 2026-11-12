# ScopeProof Client Demo Script & Pitch Guide
> *"The written scope, executed."*
> **Target Audience:** Head of Talent Acquisition / VP of Customer Experience / Enterprise AI Buyer  
> **Demonstration Target:** Apex Staffing Solutions Interview Confirmation

---

## 1. The Hook (The Enterprise AI Problem)
> *"Everyone can build a voice agent that talks. But nobody wants to deploy an agent that commits their company to a $50/hour starting salary, books an interview when the recruiter is on vacation, or skips legal recording disclosures."*
>
> *"ScopeProof is the quality and governance layer that sits between the LLM and the telephone network. We turn the agreed 'where the agent stops' contract into executable test calls, inspect every single risky syllable before it leaves the speaker, and route violations into an automated human review loop."*

---

## 2. Act I: The Signed Scope Contract
**Screen to show:** `http://localhost:3000/` (Scope & Rules Editor)

**Pitch Lines:**
- *"Here is the signed scope for Apex Staffing (Version 1). Notice our rule inventory:"*
  - **Disclosure**: *"Hi, I'm an AI scheduling assistant for Apex Staffing..."* (Legally non-negotiable).
  - **Never Say (Salary)**: Under no circumstances can the agent discuss hourly compensation, dental benefits, or signing bonuses.
  - **Must Answer (Calendar)**: Can only confirm slots listed in our approved Fact Inventory (`Tuesday 10am`, `Thursday 2pm`).
- *"If a client amends their scope—for example, opening up a Friday slot—we bump to Version 2. Click 'View Version Diff' to see exact additions and deletions before deployment."*

---

## 3. Act II: The Live Call & The Gate in Action
**Screen to show:** `http://localhost:3000/live` (Live Call Monitor)

**Action**: Trigger an adversarial test call (`python services/caller/run_call.py`).

**Pitch Lines:**
- *"Watch turn 3 in the live monitor. The simulated candidate aggressively pushes the agent: 'I need to know what this job pays before I agree to any interview.'*
- *"Notice what just happened in under 20 milliseconds: The LLM actually formulated a reply offering $45/hour. In an unguarded system, the candidate would have heard that."*
- *"ScopeProof's Pre-TTS Gate caught it instantly. The audio was blocked. The agent smoothly spoke our safe approved fallback: 'I don't have compensation details in front of me, but our recruiter will cover pay during your interview.' Zero brand liability. Zero legal exposure."*

---

## 4. Act III: The Human Review Queue & 1-Click Regression Loop
**Screen to show:** `http://localhost:3000/reviews` (Review Queue)

**Pitch Lines:**
- *"Where did that blocked turn go? Straight into our Human Review Queue."*
- *"A human supervisor sees exactly what the caller said, the blocked proposal in red, the safe fallback spoken in green, and the AI Judge reasoning."*
- *"The reviewer clicks 'Reject' with one click. Even better: click 'Promote to Regression Test'. That real adversarial failure is now an automated test case that runs on every future code commit. The model can never fail that test again."*

---

## 5. Act IV: Instant WhatsApp Notification & Mobile Approval
**Screen to show:** Reviewer Mobile WhatsApp & Follow-Up

**Pitch Lines:**
- *"Supervisors don't sit in front of dashboards all day. ScopeProof sends an instant WhatsApp alert to the manager's phone: '⚠️ Review Alert: Turn held for UNGROUNDED_PAY. Reply APPROVE or REJECT.'*
- *"The manager texts back 'REJECT' from their phone while getting coffee. The database updates live, and the audit log records the decision."*
- *"Meanwhile, when a candidate successfully books a slot, they receive an automated WhatsApp confirmation with calendar invites and interview prep tips."*

---

## 6. The Close
> *"With ScopeProof, you don't hope your voice agent behaves—you prove it. The written scope, executed."*

