import re

file_path = r"c:\Users\DELL\OneDrive\Bureau\RH_Intelligent\frontend_web\app\(protected)\admin\stats\page.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Fix common implicit any parameters in .map() and .reduce() calls
replacements = {
    r'\bd =>': r'(d: any) =>',
    r'\(s, d\) =>': r'(s: number, d: any) =>',
    r'\(s, c\) =>': r'(s: number, c: any) =>',
    r'\(\_, i\) =>': r'(_: any, i: number) =>',
    r'\(r, i\) =>': r'(r: any, i: number) =>',
    r'\(a, i\) =>': r'(a: any, i: number) =>',
    r'\(c, i\) =>': r'(c: any, i: number) =>',
    r'\(entry, i\) =>': r'(entry: any, i: number) =>',
    r'\bdept =>': r'(dept: any) =>',
    r'\bsd =>': r'(sd: any) =>',
    r'\bc =>': r'(c: any) =>',
    r'\ba =>': r'(a: any) =>',
    r'\br =>': r'(r: any) =>',
}

for pattern, repl in replacements.items():
    text = re.sub(pattern, repl, text)

# Just to be safe, avoid destroying the entire state.
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("TypeScript type fixes applied.")
