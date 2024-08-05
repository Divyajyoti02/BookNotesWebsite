import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import { config } from "dotenv";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

function isEmpty(obj) {
    for (const prop in obj) {if (Object.hasOwn(obj, prop)) {return false;}}
    return true;
}

let queryResultsGlobal = [];
let targetBook = {};

config();

const app = express();
const port = Number(process.env.MAIN_PORT);

const db = new pg.Client({
  user: process.env.DB_USERNAME,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

db.connect();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", async (req, res) => {
    let queryText = "";
    let response = await db.query("SELECT * FROM notes;");
    let noteEntries = response.rows;
    let queryResults = [];

    if (Object.hasOwn(req.query, 'q')) {queryText = req.query.q;}
    if (queryText !== "") {
        response = await axios.get(`https://openlibrary.org/search.json?q=${queryText}&limit=5`);
        response.data.docs.forEach((elem) => {queryResults.push(elem);});
    }

    queryResultsGlobal = queryResults;

    res.render("main.ejs", {
        title: targetBook.title, activeTab: "home", queryText: queryText, queryResults: queryResultsGlobal, 
        noteEntries: noteEntries
    });
});

app.get("/query", async (req, res) => {
    targetBook = queryResultsGlobal[req.query.idx];
    res.redirect("/entry");
});

app.get("/entry", async (req, res) => {
    if (isEmpty(targetBook)) {
        res.redirect("/");
    } else {
        let queryText = "";
        let response = await db.query("SELECT * FROM notes WHERE cover_id=$1;", [targetBook.cover_i]);
        let noteEntries = response.rows;
        let queryResults = [];
        let queryResultsKey = [];

        if (Object.hasOwn(req.query, 'q')) {queryText = req.query.q;}
        if (queryText !== "") {
            response = await axios.get(`https://openlibrary.org/search.json?q=${queryText}&limit=5`);
            response.data.docs.forEach((elem) => {queryResults.push(elem);});
        }

        queryResultsGlobal = queryResults;

        res.render("entry.ejs", {
            title: targetBook.title, activeTab: "home", queryText: queryText, queryResults: queryResults, 
            noteEntries: noteEntries, currentBook: targetBook
        });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});