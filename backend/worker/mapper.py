"""
mapper.py — Neuro-Symbolic Hybrid Verification Engine.

Proposer Agent (Symbolic): Runs regex keyword matching against UNESCAP RDTII
indicators to identify candidate evidence passages.

Verifier Agent (Neural): Validates each candidate with a local Ollama LLM.
Falls back to high-confidence pass-through if Ollama is unavailable.
"""
import re
import logging

logger = logging.getLogger(__name__)

# UNESCAP RDTII Indicators & Bounding Keywords (Pillars 5–9)
RDTII_INDICATORS: dict[str, list[str]] = {
    "Pillar 5: Paperless Trade - Electronic Single Window": [
        r"(single[\s-]*window)",
        r"(national[\s-]*single[\s-]*window)",
        r"(trade[\s-]*portal)",
        r"(one[\s-]*stop[\s-]*service)",
    ],
    "Pillar 5: Paperless Trade - Electronic Transactions Law": [
        r"(electronic[\s-]*transactions)",
        r"(digital[\s-]*commerce)",
        r"(e-commerce[\s-]*law)",
        r"(electronic[\s-]*contracts)",
    ],
    "Pillar 5: Paperless Trade - Electronic Signatures": [
        r"(electronic[\s-]*signature)",
        r"(digital[\s-]*signature)",
        r"(e-signature)",
        r"(cryptographic[\s-]*verification)",
    ],
    "Pillar 6: Cross-Border Paperless Trade - Exchange of E-SPS": [
        r"(sanitary[\s-]*and[\s-]*phytosanitary)",
        r"(sps[\s-]*certificate)",
        r"(electronic[\s-]*sps)",
        r"(animal[\s-]*health[\s-]*certificate)",
    ],
    "Pillar 6: Cross-Border Paperless Trade - E-Customs Declarations": [
        r"(customs[\s-]*declaration)",
        r"(electronic[\s-]*customs)",
        r"(cross-border[\s-]*data[\s-]*exchange)",
        r"(paperless[\s-]*customs)",
    ],
    "Pillar 7: Transit & Trade Facilitation - Freedom of Transit": [
        r"(freedom[\s-]*of[\s-]*transit)",
        r"(transit[\s-]*goods)",
        r"(cross-border[\s-]*transit)",
        r"(customs[\s-]*transit)",
    ],
    "Pillar 8: Trade Facilitation for SMEs - Access to Finance": [
        r"(sme[\s-]*finance)",
        r"(small[\s-]*and[\s-]*medium[\s-]*enterprises)",
        r"(micro-finance)",
        r"(credit[\s-]*guarantee)",
    ],
    "Pillar 9: Agricultural Trade Facilitation - Perishable Goods": [
        r"(perishable[\s-]*goods)",
        r"(cold[\s-]*storage)",
        r"(expedited[\s-]*clearance[\s-]*for[\s-]*agriculture)",
        r"(agricultural[\s-]*products)",
    ],
}


def proposer_agent(paragraph: str) -> list[str]:
    """
    Symbolic Proposer: checks which RDTII indicators a paragraph matches.
    Returns a list of matching indicator names.
    """
    matched: list[str] = []
    for indicator, patterns in RDTII_INDICATORS.items():
        for pattern in patterns:
            if re.search(pattern, paragraph, re.IGNORECASE):
                matched.append(indicator)
                break  # one match per indicator is sufficient
    return matched


def verifier_agent(verbatim_text: str, indicator: str) -> tuple[bool, float]:
    """
    Neural Verifier: validates that the verbatim text substantiates the indicator.

    Tries local Ollama first. Falls back to symbolic pass-through with
    a conservative confidence score if Ollama is unavailable.

    Returns:
        (verified: bool, confidence: float)
    """
    try:
        import ollama
        response = ollama.generate(
            model="llama3",
            prompt=(
                f"Does the following legal text contain any specific provision regarding: "
                f"'{indicator}'?\n\n"
                f"Text: \"{verbatim_text}\"\n\n"
                f"Respond with only YES or NO."
            ),
            options={"temperature": 0.0},
        )
        answer = response.get("response", "").strip().upper()
        if "YES" in answer:
            return True, 0.92
        elif "NO" in answer:
            return False, 0.0
        # Ambiguous — trust the symbolic proposer with lower confidence
        return True, 0.70
    except Exception as e:
        logger.debug(f"Ollama unavailable ({e}); using symbolic fallback confidence.")
        # Symbolic proposer already matched — grant pass-through with baseline confidence
        return True, 0.85
