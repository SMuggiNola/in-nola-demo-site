"""
Post-process the act HTML files and assemble the final book page.
Fixes split scene descriptions, removes artifacts, and embeds in the page template.
"""
import re

def post_process(html, act_num):
    """Fix common issues in the generated HTML."""

    # Remove stray page headers that survived
    html = re.sub(r'<p>\s*\d*\s*JUNO AND\.?\s*THE PAYCOCK\s*</p>', '', html)
    html = re.sub(r'<p>\s*1 JUNO AND THE PAYCOCK\s*</p>', '', html)
    html = re.sub(r'<p>\s*i JUNO AND THE PAYCOCK\s*</p>', '', html)
    html = re.sub(r'JUNO AND\.?\s*THE PAYCOCK\s*ACT\s*', '', html)

    # Fix "con- taining" hyphenation artifacts
    html = re.sub(r'(\w+)-\s+(\w+)', lambda m: m.group(1) + m.group(2) if len(m.group(1)) > 1 and len(m.group(2)) > 1 else m.group(0), html)

    # Fix the replacement character
    html = html.replace('\ufffd', '—')
    html = html.replace('�', '—')

    # Fix common OCR artifacts in this text
    html = html.replace("an*", "an'")
    html = html.replace("mornin*", "mornin'")
    html = html.replace("entherin*", "entherin'")
    html = html.replace("stoppin*", "stoppin'")
    html = html.replace("losin*", "losin'")
    html = html.replace("readin*", "readin'")
    html = html.replace("makin*", "makin'")
    html = html.replace("nothin*", "nothin'")
    html = html.replace("doin*", "doin'")
    html = html.replace("goin*", "goin'")
    html = html.replace("knockin*", "knockin'")
    html = html.replace("bringin*", "bringin'")
    html = html.replace("afther*", "afther'")
    html = html.replace("1suppose", "I suppose")

    # Fix ?' and !) at end of stage directions
    html = re.sub(r'\?\)', ')', html)
    html = re.sub(r'!\)', ')', html)

    # Remove empty paragraphs
    html = re.sub(r'<p>\s*</p>', '', html)

    return html.strip()


def fix_act1_scene(html):
    """Fix Act I's split scene description."""
    # The scene description got cut and continued in the next paragraph
    # Merge the scene-description div with the following paragraph that continues it
    pattern = (
        r'(<div class="scene-description">.*?)</div>\s*'
        r'<p>(teapot is on the hob.*?The time is early forenoon\.)</p>'
    )
    replacement = r'\1 \2</div>'
    html = re.sub(pattern, replacement, html, flags=re.DOTALL)

    # Also fix the split stage direction for Mrs. Boyle's entrance
    html = html.replace(
        '<p>(MRS. BOYLE enters by door on right; she has been shopping and carries a small</p>',
        ''
    )
    html = html.replace(
        "<p>parcel in her hand. She is forty-five years of age, and twenty years ago she must have been a pretty woman; but her face has now assumed that look which ultimately settles down upon the faces of the women of the working- class; a look of listless monotony and harassed anxiety, blending with an expression of mechanical resistance. Were circumstances favourable, she would probably be a handsome, active and clever woman.')</p>",
        '<p><span class="stage">(Mrs. Boyle enters by door on right; she has been shopping and carries a small parcel in her hand. She is forty-five years of age, and twenty years ago she must have been a pretty woman; but her face has now assumed that look which ultimately settles down upon the faces of the women of the working-class; a look of listless monotony and harassed anxiety, blending with an expression of mechanical resistance. Were circumstances favourable, she would probably be a handsome, active and clever woman.)</span></p>'
    )

    return html


def fix_act3_scene(html):
    """Fix Act III's severely split scene description."""
    # Remove the fragmented scene description and replace with a clean one
    # First, remove all the fragments
    fragments = [
        '<div class="scene-description">SCENE : The same as Act II. It is about half- past six on a November evening; a bright fire is burning in the grate; MARY, dressed to</div>',
        '<p>go out, is sitting on a chair by the fire, leaning forward, her hands under her chin, her</p>',
        '<p>elbows on her knees. A look of dejection,</p>',
        '<p>mingled with uncertain anxiety , is on her face.</p>',
        '<p>A lamp) turned low, is lighting on the table.</p>',
        '<p>The votive light under the picture of the</p>',
        '<p>Virgin gleams more redly than ever. MRS.</p>',
        '<p><span class="char">Boyle.</span> is putting on her hat and coat. It is</p>',
        '<p>two months later.</p>',
    ]

    for frag in fragments:
        html = html.replace(frag, '')

    # Insert the clean scene description after the act title
    clean_scene = '''<div class="scene-description">The same as Act II. It is about half-past six on a November evening; a bright fire is burning in the grate; Mary, dressed to go out, is sitting on a chair by the fire, leaning forward, her hands under her chin, her elbows on her knees. A look of dejection, mingled with uncertain anxiety, is on her face. A lamp, turned low, is lighting on the table. The votive light under the picture of the Virgin gleams more redly than ever. Mrs. Boyle is putting on her hat and coat. It is two months later.</div>'''

    html = html.replace(
        '<h2 class="act-title" id="act3">Act III</h2>',
        '<h2 class="act-title" id="act3">Act III</h2>\n' + clean_scene
    )

    return html


# Read act files
with open(r"C:\in-nola-demo-site\Our-Village\Our_Library\Juno_And_The_Paycock\act1_final.html", "r", encoding="utf-8") as f:
    act1 = f.read()
with open(r"C:\in-nola-demo-site\Our-Village\Our_Library\Juno_And_The_Paycock\act2_final.html", "r", encoding="utf-8") as f:
    act2 = f.read()
with open(r"C:\in-nola-demo-site\Our-Village\Our_Library\Juno_And_The_Paycock\act3_final.html", "r", encoding="utf-8") as f:
    act3 = f.read()

# Post-process
act1 = post_process(act1, 1)
act1 = fix_act1_scene(act1)
act2 = post_process(act2, 2)
act3 = post_process(act3, 3)
act3 = fix_act3_scene(act3)

# Read the template
with open(r"C:\in-nola-demo-site\Our-Village\Our_Library\Juno_And_The_Paycock\index.html", "r", encoding="utf-8") as f:
    template = f.read()

# Insert act content into the template
template = template.replace(
    '<!-- PLACEHOLDER: Will be filled with cleaned Act I content -->',
    act1
)
template = template.replace(
    '<!-- PLACEHOLDER: Will be filled with cleaned Act II content -->',
    act2
)
template = template.replace(
    '<!-- PLACEHOLDER: Will be filled with cleaned Act III content -->',
    act3
)

# Write final file
with open(r"C:\in-nola-demo-site\Our-Village\Our_Library\Juno_And_The_Paycock\index.html", "w", encoding="utf-8") as f:
    f.write(template)

print(f"Final page assembled: {len(template)} chars")
print(f"Act I: {len(act1)} chars")
print(f"Act II: {len(act2)} chars")
print(f"Act III: {len(act3)} chars")

# Quick check - count dialogue lines per act
for label, content in [("Act I", act1), ("Act II", act2), ("Act III", act3)]:
    speeches = content.count('<span class="char">')
    stages = content.count('<span class="stage">')
    print(f"{label}: {speeches} speeches, {stages} stage directions")
