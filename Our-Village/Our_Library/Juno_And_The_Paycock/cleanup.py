"""
Cleanup OCR text from Juno and the Paycock PDF and convert to HTML.
Uses known text of this public domain play to correct OCR errors.
"""
import re
import html

def clean_ocr(text):
    """Heavy OCR cleanup for the garbled PDF text."""

    # Remove page markers and headers
    text = re.sub(r'--- PAGE \d+ ---\n?', '\n', text)
    text = re.sub(r'^\d+\s+JUNO\s*AND\s*THE\s*PAYCOCK.*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^JUNO\s*AND\s*THE\s*PAYCOCK.*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^jtjnoandthePAYCOCK.*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^JITNOANDTHEPAYCOCK.*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^Act\s*[IVX]+\.?\].*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\[Act\s*[IVX]+\.?.*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^Aot\s*[IVX]+\.?\].*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\[Aor\s*\d+\.?.*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\[AC3T.*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^Anr\s*T\.?\].*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^Ifl\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'\* if.*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^ACT TI$', 'ACT II', text, flags=re.MULTILINE)

    # Fix special characters
    text = text.replace('\ufffd', "'")
    text = text.replace('\u2019', "'")
    text = text.replace('\u2018', "'")
    text = re.sub(r"o[*]", "o'", text)

    # Fix braces used as parens
    text = text.replace('{', '(')
    text = text.replace('}', ')')

    # Fix caret
    text = re.sub(r'(\w)\^(\w)', r'\1 \2', text)
    text = text.replace('^', ' ')

    # OCR character fixes
    fixes = {
        'Mbs.': 'Mrs.',
        'Mrs,': 'Mrs.',
        'JoxER': 'Joxer',
        'JoxEB': 'Joxer',
        'Bkntham': 'Bentham',
        'Bentuam': 'Bentham',
        'Bontham': 'Bentham',
        'Bcntham': 'Bentham',
        'Tancrkd': 'Tancred',
        'motlier': 'mother',
        'annehair': 'armchair',
        'curtmned': 'curtained',
        'Abomdoor': 'Above door',
        'bje-road': 'bye-road',
        'etidoftable': 'end of table',
        'sleem': 'sleeve',
        'toith': 'with',
        'i?>': 'is',
        'woma T%': 'woman',
        'aatn e': 'active',
        'lieisa': 'He is a',
        'lieisathin': 'He is a thin',
        'arcinitthis': 'are in it this',
        'hou.se': 'house',
        'ha.sboon': 'has been',
    }
    for old, new in fixes.items():
        text = text.replace(old, new)

    # Fix merged words
    merges = [
        ('ofthe', 'of the'), ('tothe', 'to the'), ('inthe', 'in the'),
        ('onthe', 'on the'), ('atthe', 'at the'), ('bythe', 'by the'),
        ('forthe', 'for the'), ('isthe', 'is the'), ('andthe', 'and the'),
        ('butthe', 'but the'), ('orthe', 'or the'), ('fromthe', 'from the'),
        ('aboutthe', 'about the'), ('withthe', 'with the'), ('hasthe', 'has the'),
        ('afterthe', 'after the'), ('intothe', 'into the'), ('overthe', 'over the'),
        ('underthe', 'under the'), ('behindthe', 'behind the'),
        ('ofher', 'of her'), ('ofhis', 'of his'), ('ofhim', 'of him'),
        ('ofme', 'of me'), ('ofyou', 'of you'), ('ofit', 'of it'),
        ('ofus', 'of us'), ('ofthem', 'of them'),
        ('toher', 'to her'), ('tohim', 'to him'), ('tome', 'to me'),
        ('toyou', 'to you'), ('toit', 'to it'), ('tous', 'to us'),
        ('inher', 'in her'), ('inhis', 'in his'), ('inhim', 'in him'),
        ('inme', 'in me'), ('inyou', 'in you'),
        ('onher', 'on her'), ('onhis', 'on his'), ('onhim', 'on him'),
        ('onme', 'on me'),
        ('ather', 'at her'), ('athis', 'at his'), ('athim', 'at him'),
        ('atme', 'at me'),
        ('byher', 'by her'), ('byhis', 'by his'), ('byhim', 'by him'),
        ('forher', 'for her'), ('forhim', 'for him'), ('forme', 'for me'),
        ('foryou', 'for you'), ('forus', 'for us'),
        ('isa', 'is a'), ('isan', 'is an'), ('wasa', 'was a'),
        ('hasa', 'has a'), ('hasan', 'has an'),
        ('ina', 'in a'), ('ona', 'on a'), ('ata', 'at a'),
        ('bya', 'by a'), ('toa', 'to a'), ('fora', 'for a'),
        ('nota', 'not a'), ('hada', 'had a'), ('gota', 'got a'),
        ('witha', 'with a'), ('withan', 'with an'),
        ('abouta', 'about a'), ('aftera', 'after a'),
        ('tobe', 'to be'), ('toget', 'to get'), ('todo', 'to do'),
        ('togo', 'to go'), ('tocome', 'to come'), ('totell', 'to tell'),
        ('tohave', 'to have'), ('toknow', 'to know'), ('tosee', 'to see'),
        ('tomake', 'to make'), ('togive', 'to give'), ('totake', 'to take'),
        ('tosay', 'to say'), ('tobring', 'to bring'), ('toput', 'to put'),
        ('tolook', 'to look'), ('tostay', 'to stay'), ('tokeep', 'to keep'),
        ('tostop', 'to stop'), ('toopen', 'to open'), ('toclose', 'to close'),
        ('tohear', 'to hear'), ('tothink', 'to think'),
        ('tosit', 'to sit'), ('tostand', 'to stand'),
        ('toask', 'to ask'), ('towalk', 'to walk'), ('totry', 'to try'),
        ('towork', 'to work'), ('towear', 'to wear'), ('tolet', 'to let'),
        ('tolisten', 'to listen'), ('tohelp', 'to help'),
        ('toleave', 'to leave'), ('towrite', 'to write'),
        ('ifyou', 'if you'), ('ifhe', 'if he'), ('ifshe', 'if she'),
        ('ifthe', 'if the'), ('ifthat', 'if that'), ('ifwe', 'if we'),
        ('ifthey', 'if they'), ('ifthere', 'if there'),
        ('hehas', 'he has'), ('heis', 'he is'), ('hewas', 'he was'),
        ('sheis', 'she is'), ('shewas', 'she was'), ('shehas', 'she has'),
        ('youare', 'you are'), ('youwere', 'you were'),
        ('itwas', 'it was'), ('itis', 'it is'),
        ('thatI', 'that I'), ('thathe', 'that he'), ('thatshe', 'that she'),
        ('whathe', 'what he'), ('whatshe', 'what she'),
        ('whenhe', 'when he'), ('whenshe', 'when she'),
        ('whenthe', 'when the'), ('whenI', 'when I'),
        ('mustbe', 'must be'), ('maybe', 'may be'),
        ('willbe', 'will be'), ('canbe', 'can be'),
        ('theman', 'the man'), ('thewoman', 'the woman'),
    ]

    for old, new in merges:
        text = re.sub(r'(?<![a-zA-Z\x27-])' + re.escape(old) + r'(?![a-zA-Z\x27-])', new, text)

    # Fix lowercase-Uppercase merges
    text = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)

    # Fix spacing around punctuation
    text = re.sub(r'\.([A-Z])', r'. \1', text)
    text = re.sub(r';([a-zA-Z])', r'; \1', text)
    text = re.sub(r':([a-zA-Z])', r': \1', text)

    # Clean up whitespace
    text = re.sub(r'  +', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'^\s+', '', text, flags=re.MULTILINE)

    return text.strip()


def text_to_html(text, act_num):
    """Convert cleaned play text to HTML with proper formatting."""

    lines = text.split('\n')
    html_parts = []

    # Character name patterns (at start of line, possibly with stage direction)
    char_pattern = re.compile(
        r'^(Mrs?\.\s*Boyle|Boyle|Mary|Johnny|Joxer|Bentham|Jerry|'
        r'Mrs?\.\s*Madigan|Mrs?\.\s*Tancred|Nugent|'
        r'Voice\s+of\s+\w+|Voice\s+op?\s+\w+|Voice\s+of\s+Coal\s*Vendor|'
        r'Coal-block Vendor|Sewing Machine Man|Mobilizer|'
        r'An? Irregular|First Man|Second Man|'
        r'First Neighbour|Second Neighbour|'
        r'Irregular|Irregulars|The Mobilizer|'
        r'All)\s*[\.\!]?\s*(\(.*?\))?\s*(.*)',
        re.IGNORECASE
    )

    # Stage direction pattern (full line in parentheses)
    stage_pattern = re.compile(r'^\(.*\)\s*$')

    # Song detection
    in_song = False
    current_block = []

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if not line:
            i += 1
            continue

        # Check for ACT heading
        if re.match(r'^ACT\s+(I+|II|III|IV|V)\s*$', line):
            html_parts.append(f'<h2 class="act-title" id="act{act_num}">Act {"I" * act_num if act_num < 4 else str(act_num)}</h2>')
            i += 1
            continue

        # Check for Scene description (usually at the start)
        if line.startswith('Scene.') or line.startswith('Scene.') or line.startswith('Sc ENE') or line.startswith('ScKNE'):
            # Collect multi-line scene description
            scene_lines = [line]
            i += 1
            while i < len(lines):
                next_line = lines[i].strip()
                if not next_line or char_pattern.match(next_line):
                    break
                # Check if this looks like it starts dialogue
                if re.match(r'^(Mrs?\.|Boyle|Mary|Johnny|Joxer)', next_line):
                    break
                scene_lines.append(next_line)
                i += 1
            scene_text = ' '.join(scene_lines)
            html_parts.append(f'<div class="scene-description">{scene_text}</div>')
            continue

        # Check for pure stage direction line
        if line.startswith('(') and line.endswith(')'):
            html_parts.append(f'<p><span class="stage">{line}</span></p>')
            i += 1
            continue

        # Check if line starts with a character name
        char_match = char_pattern.match(line)
        if char_match:
            char_name = char_match.group(1).strip()
            # Collect the full speech (may span multiple lines)
            speech_lines = [line]
            i += 1
            while i < len(lines):
                next_line = lines[i].strip()
                if not next_line:
                    i += 1
                    break
                # Check if next line starts a new character's speech or stage direction
                if char_pattern.match(next_line) or stage_pattern.match(next_line):
                    break
                speech_lines.append(next_line)
                i += 1

            full_speech = ' '.join(speech_lines)

            # Format the character name within the speech
            # Find where the character name ends and dialogue begins
            name_match = re.match(
                r'^((?:Mrs?\.\s*)?(?:Boyle|Mary|Johnny|Joxer|Bentham|Jerry|Madigan|Tancred|Nugent|'
                r'Voice\s+of\s+[\w\s]+?|Coal-block Vendor|Sewing Machine Man|Mobilizer|'
                r'An? Irregular|First Man|Second Man|First Neighbour|Second Neighbour|'
                r'Irregular|The Mobilizer|All))\s*[\.\!]?\s*(.*)',
                full_speech, re.IGNORECASE
            )

            if name_match:
                name = name_match.group(1).strip()
                rest = name_match.group(2).strip()

                # Format stage directions within the speech
                rest = re.sub(r'\(([^)]+)\)', r'<span class="stage">(\1)</span>', rest)

                html_parts.append(f'<p><span class="char">{name}.</span> {rest}</p>')
            else:
                html_parts.append(f'<p>{full_speech}</p>')
            continue

        # Check for singing/song lines
        if '(Singing' in line or '(singing' in line:
            html_parts.append(f'<p class="song">{line}</p>')
            i += 1
            continue

        # Default: just a paragraph (likely continuation or stage direction)
        # Collect multi-line paragraph
        para_lines = [line]
        i += 1
        while i < len(lines):
            next_line = lines[i].strip()
            if not next_line or char_pattern.match(next_line) or stage_pattern.match(next_line):
                break
            para_lines.append(next_line)
            i += 1

        full_para = ' '.join(para_lines)
        # Check if it looks like a stage direction
        if full_para.startswith('(') or re.match(r'^\(', full_para):
            full_para = re.sub(r'\(([^)]+)\)', r'<span class="stage">(\1)</span>', full_para)
            html_parts.append(f'<p>{full_para}</p>')
        else:
            html_parts.append(f'<p>{full_para}</p>')

    return '\n'.join(html_parts)


# Main execution
with open(r"C:\in-nola-demo-site\Our-Village\Our_Library\Juno_And_The_Paycock\raw_text.txt", "r", encoding="utf-8") as f:
    lines = f.readlines()

act1_raw = "".join(lines[111:1145])
act2_raw = "".join(lines[1145:1965])
act3_raw = "".join(lines[1966:2879])

for act_num, (label, raw) in enumerate([(
    "act1", act1_raw), ("act2", act2_raw), ("act3", act3_raw)], 1):
    cleaned = clean_ocr(raw)
    act_html = text_to_html(cleaned, act_num)

    outpath = rf"C:\in-nola-demo-site\Our-Village\Our_Library\Juno_And_The_Paycock\{label}_clean.html"
    with open(outpath, "w", encoding="utf-8") as f:
        f.write(act_html)

    print(f"Act {act_num}: {len(act_html)} chars written to {label}_clean.html")
    print(f"  Sample: {act_html[:300]}...")
    print()
