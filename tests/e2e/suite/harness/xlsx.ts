/**
 * Reads what an Excel file (.xlsx) the app downloaded holds: its sheets and how many rows each
 * has. Enough to check a download against the backend's data, with what Node has: an .xlsx is a
 * zip of XML files, and the suite cannot count on any Excel library being installed in the app
 * that runs it.
 */
import fs from 'node:fs'
import zlib from 'node:zlib'

export interface Sheet {
  name: string
  /** Rows with something in them, the header included. */
  rows: number
}

/** The files of a zip, by name. Stored and deflated entries, as Excel files use. */
function unzip(file: string): Map<string, string> {
  const zip = fs.readFileSync(file)
  // The end-of-central-directory record is in the last 64 KB (its comment is at most that long).
  let end = -1
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      end = i
      break
    }
  }
  if (end < 0)
    throw new Error(`${file} is not an Excel file (no zip directory)`)

  const files = new Map<string, string>()
  const count = zip.readUInt16LE(end + 10)
  let entry = zip.readUInt32LE(end + 16)
  for (let n = 0; n < count; n++) {
    if (zip.readUInt32LE(entry) !== 0x02014b50) break
    const method = zip.readUInt16LE(entry + 10)
    const size = zip.readUInt32LE(entry + 20)
    const nameLength = zip.readUInt16LE(entry + 28)
    const extraLength = zip.readUInt16LE(entry + 30)
    const commentLength = zip.readUInt16LE(entry + 32)
    const local = zip.readUInt32LE(entry + 42)
    const name = zip.toString('utf-8', entry + 46, entry + 46 + nameLength)
    const start =
      local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
    const raw = zip.subarray(start, start + size)
    if (method === 0 || method === 8) {
      files.set(
        name,
        (method === 8 ? zlib.inflateRawSync(raw) : raw).toString('utf-8'),
      )
    }
    entry += 46 + nameLength + extraLength + commentLength
  }
  return files
}

/** The sheets of an .xlsx file, in order, with their rows. */
export function readSheets(file: string): Sheet[] {
  const files = unzip(file)
  const workbook = files.get('xl/workbook.xml')
  const relations = files.get('xl/_rels/workbook.xml.rels')
  if (!workbook || !relations)
    throw new Error(`${file} is not an Excel file (no workbook)`)

  const targets = new Map<string, string>()
  for (const [, attributes] of relations.matchAll(
    /<Relationship\b([^>]*)\/?>/g,
  )) {
    const id = /\bId="([^"]+)"/.exec(attributes)?.[1]
    const target = /\bTarget="([^"]+)"/.exec(attributes)?.[1]
    if (id && target) targets.set(id, target.replace(/^\/?(xl\/)?/, 'xl/'))
  }

  const sheets: Sheet[] = []
  for (const [, attributes] of workbook.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = /\bname="([^"]*)"/.exec(attributes)?.[1] ?? ''
    const id = /\br:id="([^"]+)"/.exec(attributes)?.[1] ?? ''
    const xml = files.get(targets.get(id) ?? '') ?? ''
    // Only rows with a value count: a row of cells that are only styled (`<c r="A2" s="3"/>`, as
    // an empty table's row of blanks) holds nothing.
    const rows = [
      ...xml.matchAll(/<row\b[^>]*?(\/>|>([\s\S]*?)<\/row>)/g),
    ].filter(([, , cells]) => cells && /<(v|is)\b/.test(cells)).length
    sheets.push({ name: decodeXml(name), rows })
  }
  return sheets
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}
