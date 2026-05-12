import * as XLSX from "xlsx";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const players = [
    // first_name, last_name, date_of_birth, nationality, preferred_foot, height_cm, weight_kg
    ["Abebe", "Bikila", "1995-03-12", "Ethiopian", "right", 175, 68],
    ["Haile", "Gebrselassie", "1997-08-24", "Ethiopian", "right", 164, 56],
    ["Dawit", "Wolde", "1999-11-05", "Ethiopian", "left", 180, 74],
    ["Yonas", "Tesfaye", "2000-06-18", "Ethiopian", "right", 178, 72],
    ["Biruk", "Alemu", "1998-02-27", "Ethiopian", "both", 172, 65],
    ["Selam", "Tadesse", "2001-09-14", "Ethiopian", "right", 176, 70],
    ["Mikias", "Hailu", "1996-04-30", "Ethiopian", "left", 183, 78],
    ["Natnael", "Girma", "2002-01-08", "Ethiopian", "right", 169, 62],
    ["Ermias", "Bekele", "1999-07-22", "Ethiopian", "right", 181, 76],
    ["Tewodros", "Mengistu", "2000-12-03", "Ethiopian", "left", 174, 67],
    ["Henok", "Desta", "1997-05-16", "Ethiopian", "right", 177, 71],
    ["Robel", "Habtamu", "2001-03-29", "Ethiopian", "both", 170, 64],
    ["Fitsum", "Negash", "1998-10-11", "Ethiopian", "right", 185, 80],
    ["Amanuel", "Tsegay", "2003-02-19", "Ethiopian", "left", 168, 60],
    ["Kaleab", "Worku", "1996-08-07", "Ethiopian", "right", 179, 73],
    ["Surafel", "Abebe", "2000-04-25", "Ethiopian", "right", 182, 77],
    ["Leul", "Solomon", "1999-11-30", "Ethiopian", "left", 173, 66],
    ["Binyam", "Tekeste", "2002-06-13", "Ethiopian", "right", 186, 82],
    ["Yared", "Mulugeta", "1997-09-02", "Ethiopian", "both", 171, 63],
    ["Dagim", "Kebede", "2001-07-17", "Ethiopian", "right", 180, 75],
];

const header = [
    "first_name",
    "last_name",
    "date_of_birth",
    "nationality",
    "preferred_foot",
    "height_cm",
    "weight_kg",
];

const rows = [header, ...players];

const ws = XLSX.utils.aoa_to_sheet(rows);

// Column widths
ws["!cols"] = [
    { wch: 14 }, // first_name
    { wch: 16 }, // last_name
    { wch: 14 }, // date_of_birth
    { wch: 12 }, // nationality
    { wch: 14 }, // preferred_foot
    { wch: 10 }, // height_cm
    { wch: 10 }, // weight_kg
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Players");

const outPath = path.join(__dirname, "..", "test-players.xlsx");
XLSX.writeFile(wb, outPath);
console.log(`✅  Written: ${outPath}`);
