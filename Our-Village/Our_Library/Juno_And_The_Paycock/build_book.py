"""
Convert clean Juno and the Paycock text to HTML for the page-turning book reader.
"""
import re

# Read the clean text
with open(r"C:\in-nola-demo-site\Our-Village\Our_Library\txt_juno_check", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Extract acts
act1_lines = lines[210:2040]  # ACT I to ACT II
act2_lines = lines[2040:3430]  # ACT II to ACT III
act3_lines = lines[3430:]       # ACT III to end


def clean_and_convert(lines_list, act_num, act_roman):
    """Convert text lines to formatted HTML."""

    text = "".join(lines_list)

    # Remove page numbers (standalone numbers on their own line)
    text = re.sub(r'^\d+\s*$', '', text, flags=re.MULTILINE)
    # Remove page headers
    text = re.sub(r'^\s*i?\s*JUNO AND\.?\s*THE PAYCOCK\s*ACT\s*i?\s*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*ACT\s+III\s+JUNO AND THE PAYCOCK\s*$', '', text, flags=re.MULTILINE)
    # Remove standalone letters that are page artifacts
    text = re.sub(r'^\s*[A-Z]\s*$', '', text, flags=re.MULTILINE)
    # Remove "33 D" type page number + signature marks
    text = re.sub(r'^\d+\s+[A-Z]\s*$', '', text, flags=re.MULTILINE)

    # Clean up multiple blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)

    # Fix some OCR artifacts
    text = text.replace('an*', "an'")
    text = text.replace('entherin*', "entherin'")
    text = text.replace('mornin*', "mornin'")
    text = text.replace('?)', ')')
    text = text.replace('!)', ')')
    text = text.replace('}', ')')
    text = text.replace('{', '(')
    text = re.sub(r'\?\s*\)', ')', text)  # Fix ?) artifacts

    # Split into paragraphs (double newline separated)
    paragraphs = re.split(r'\n\n+', text.strip())

    html_parts = []

    # Character name pattern - matches names at start of paragraphs
    char_names = [
        'MRS. BOYLE', 'BOYLE', 'MARY', 'JOHNNY', 'JOXER',
        'JERRY', 'BENTHAM', 'MRS. MADIGAN', 'MRS. TANCRED',
        'NUGENT', 'THE COAL VENDOR', 'COAL VENDOR',
        'VOICE OF JOHNNY INSIDE', 'VOICE OF JOHNNY',
        'VOICE OF COAL VENDOR', 'VOICE OF JOXER',
        'VOICE OF MRS. MADIGAN', 'VOICE OF MRS. BOYLE',
        'VOICE OF AN IRREGULAR',
        'AN IRREGULAR', 'FIRST IRREGULAR', 'SECOND IRREGULAR',
        'THE MOBILIZER', 'MOBILIZER', 'AN IRREGULAR MOBILIZER',
        'FIRST MAN', 'SECOND MAN',
        'FIRST NEIGHBOUR', 'SECOND NEIGHBOUR',
        'A NEIGHBOUR', 'THE NEIGHBOUR',
        'SEWING-MACHINE MAN', 'SEWING MACHINE MAN',
        'FIRST FURNITURE MAN', 'SECOND FURNITURE MAN',
        'FIRST REMOVAL MAN', 'SECOND REMOVAL MAN',
        'ALL', 'MRS. BOYLE AND MARY',
    ]

    # Sort by length (longest first) so "MRS. BOYLE" matches before "BOYLE"
    char_names.sort(key=len, reverse=True)
    char_pattern = '|'.join(re.escape(n) for n in char_names)

    # Detect if paragraph starts with a character name
    speech_re = re.compile(
        r'^(' + char_pattern + r')[.,]?\s*(.*)',
        re.DOTALL | re.IGNORECASE
    )

    # Stage direction pattern (paragraph that starts with parenthesis)
    stage_re = re.compile(r'^\(.*\)\s*$', re.DOTALL)

    act_heading_added = False
    scene_desc_done = False

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # Join multi-line paragraphs into single line
        para = re.sub(r'\n\s*', ' ', para)
        para = re.sub(r'\s+', ' ', para).strip()

        # Skip the ACT heading line from source
        if re.match(r'^ACT\s+(I+|II|III|IV|V)\s*$', para):
            if not act_heading_added:
                html_parts.append(f'<h2 class="act-title" id="act{act_num}">{act_roman}</h2>')
                act_heading_added = True
            continue

        # Scene description (the block right after the act heading, before first dialogue)
        if not scene_desc_done and not speech_re.match(para) and not para.startswith('('):
            # This is likely the scene description
            if 'room' in para.lower() or 'scene' in para.lower() or 'living' in para.lower() or 'tenancy' in para.lower() or 'same as' in para.lower() or 'curtain' in para.lower():
                html_parts.append(f'<div class="scene-description">{para}</div>')
                scene_desc_done = True
                continue
            elif not act_heading_added:
                # Might be pre-act content, skip
                continue

        if not scene_desc_done and act_heading_added:
            # Everything before first dialogue after act heading is scene description
            if not speech_re.match(para) and not para.startswith('('):
                html_parts.append(f'<div class="scene-description">{para}</div>')
                continue
            else:
                scene_desc_done = True

        # Check for character speech
        speech_match = speech_re.match(para)
        if speech_match:
            raw_name = speech_match.group(1).strip()
            rest = speech_match.group(2).strip()

            # Normalize character name to title case
            name_map = {
                'mrs. boyle': 'Mrs. Boyle',
                'boyle': 'Boyle',
                'mary': 'Mary',
                'johnny': 'Johnny',
                'joxer': 'Joxer',
                'jerry': 'Jerry',
                'bentham': 'Bentham',
                'mrs. madigan': 'Mrs. Madigan',
                'mrs. tancred': 'Mrs. Tancred',
                'nugent': 'Nugent',
                'the coal vendor': 'The Coal Vendor',
                'coal vendor': 'Coal Vendor',
                'voice of johnny inside': 'Voice of Johnny',
                'voice of johnny': 'Voice of Johnny',
                'voice of coal vendor': 'Voice of Coal Vendor',
                'voice of joxer': 'Voice of Joxer',
                'voice of mrs. madigan': 'Voice of Mrs. Madigan',
                'voice of mrs. boyle': 'Voice of Mrs. Boyle',
                'voice of an irregular': 'Voice of an Irregular',
                'an irregular': 'An Irregular',
                'an irregular mobilizer': 'An Irregular Mobilizer',
                'first irregular': 'First Irregular',
                'second irregular': 'Second Irregular',
                'the mobilizer': 'The Mobilizer',
                'mobilizer': 'Mobilizer',
                'first man': 'First Man',
                'second man': 'Second Man',
                'first neighbour': 'First Neighbour',
                'second neighbour': 'Second Neighbour',
                'a neighbour': 'A Neighbour',
                'the neighbour': 'The Neighbour',
                'sewing-machine man': 'Sewing-Machine Man',
                'sewing machine man': 'Sewing Machine Man',
                'first furniture man': 'First Furniture Man',
                'second furniture man': 'Second Furniture Man',
                'first removal man': 'First Removal Man',
                'second removal man': 'Second Removal Man',
                'all': 'All',
                'mrs. boyle and mary': 'Mrs. Boyle and Mary',
            }

            display_name = name_map.get(raw_name.lower(), raw_name.title())

            # Format stage directions within the speech (text in parentheses)
            rest = re.sub(r'\(([^)]+)\)', r'<span class="stage">(\1)</span>', rest)

            # Check for songs (lines starting with singing direction)
            if '(singing' in rest.lower() or '(Singing' in rest:
                html_parts.append(f'<p><span class="char">{display_name}.</span> {rest}</p>')
            else:
                html_parts.append(f'<p><span class="char">{display_name}.</span> {rest}</p>')
            continue

        # Check for standalone stage direction
        if para.startswith('('):
            # Format the stage direction
            inner = para
            inner = re.sub(r'\(([^)]+)\)', r'<span class="stage">(\1)</span>', inner)
            # If the whole thing is one stage direction
            if para.startswith('(') and para.endswith(')'):
                html_parts.append(f'<p><span class="stage">{para}</span></p>')
            else:
                html_parts.append(f'<p>{inner}</p>')
            continue

        # Check if it looks like a song
        if any(word in para.lower() for word in ['when the robins', 'if i were a blackbird', 'home to our mountains', 'hail, mary']):
            html_parts.append(f'<p class="song">{para}</p>')
            continue

        # Default: regular paragraph
        # Format any stage directions within
        para = re.sub(r'\(([^)]+)\)', r'<span class="stage">(\1)</span>', para)
        html_parts.append(f'<p>{para}</p>')

    return '\n'.join(html_parts)


# Process all three acts
act1_html = clean_and_convert(act1_lines, 1, "Act I")
act2_html = clean_and_convert(act2_lines, 2, "Act II")
act3_html = clean_and_convert(act3_lines, 3, "Act III")

# Write individual act files
for label, content in [("act1", act1_html), ("act2", act2_html), ("act3", act3_html)]:
    path = rf"C:\in-nola-demo-site\Our-Village\Our_Library\Juno_And_The_Paycock\{label}_final.html"
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"{label}: {len(content)} chars")

# Show samples
print("\n=== ACT I SAMPLE ===")
print(act1_html[:2000])
print("\n=== ACT II SAMPLE ===")
print(act2_html[:1000])
print("\n=== ACT III SAMPLE ===")
print(act3_html[:1000])
