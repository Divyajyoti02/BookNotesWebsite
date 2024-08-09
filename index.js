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

function isEmptyOrSpaces(str) {return str === null || str.match(/^ *$/) !== null;}

async function queryProcess(queryText) {
    let queryResults = [];

    if (queryText !== "") {
        let response = await axios.get(`https://openlibrary.org/search.json?q=${queryText}&limit=5`);
        response.data.docs.forEach((elem) => {queryResults.push(elem);});
    }

    return queryResults;
}

class Book {
    constructor(cover_id, book_name, author) {
        this.cover_i = cover_id;
        this.title = book_name;
        this.author_name = JSON.parse(`[${author.substring(1, author.length - 1)}]`);
    }
}

let queryResultsGlobal = [];
let targetBook = {};
let noteEntriesGlobal = [];

config();

const app = express();
const port = Number(process.env.MAIN_PORT);

const db = new pg.Client({
    user: process.env.DB_USERNAME,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: true,
        ca: process.env.CA
    }
});

db.connect();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/search", async (req, res) => {
    let response = await queryProcess(req.query.q);
    queryResultsGlobal = response;

    res.json(JSON.stringify(response));
});

app.get("/", async (req, res) => {
    let response = await db.query("SELECT * FROM notes ORDER BY id;");

    noteEntriesGlobal = response.rows;

    res.render("main.ejs", {title: "Book Notes", noteEntries: noteEntriesGlobal});
});

app.get("/query", async (req, res) => {
    targetBook = queryResultsGlobal[req.query.idx];
    res.redirect("/entry");
});

app.get("/entry", async (req, res) => {
    if (isEmpty(targetBook)) {
        res.redirect("/");
    } else {
        res.render("entry.ejs", {title: targetBook.title, noteEntries: noteEntriesGlobal, currentBook: targetBook});
    }
});

app.get("/create", async (req, res) => {
    if (isEmpty(targetBook)) {
        res.redirect("/");
    } else {
        res.render("create.ejs", {title: targetBook.title, currentBook: targetBook, isError: false});
    }
});

app.post("/create", async (req, res) => {
    if (isEmpty(targetBook)) {
        res.redirect("/");
    } else if (isEmptyOrSpaces(req.body.note)) {
        res.render("create.ejs", {title: targetBook.title, currentBook: targetBook, isError: false});
    } else {
        const t = new Date(Date.now()).toISOString();
        let response = await db.query(
            "INSERT INTO notes (cover_id, book_name, author, description, created_time, updated_time) VALUES ($1, $2, $3, $4, $5, $6);",
            [targetBook.cover_i, targetBook.title, targetBook.author_name, req.body.note, t, t]
        );

        queryResultsGlobal = [];
        targetBook = {};
        
        res.redirect("/");
    }
});

app.post("/cancel", async (req, res) => {
    res.redirect("/entry");
});

app.get("/edit", async (req, res) => {
    if (isEmpty(targetBook)) {
        res.redirect("/");
    } else {
        let response = await db.query("SELECT * FROM notes WHERE cover_id=$1 ORDER BY id;", [targetBook.cover_i]);
        let noteEntries = response.rows;

        res.render("edit.ejs", {
            title: targetBook.title, noteEntries: noteEntries, currentBook: targetBook, isError: false
        });
    }
});

app.post("/edit", async (req, res) => {
    if (isEmpty(targetBook)) {
        res.redirect("/");
    } else if (isEmptyOrSpaces(req.body.note)) {
        let response = await db.query("SELECT * FROM notes WHERE cover_id=$1 ORDER BY id;", [targetBook.cover_i]);
        let noteEntries = response.rows;

        res.render("edit.ejs", {
            title: targetBook.title, noteEntries: noteEntries, currentBook: targetBook, isError: false
        });
    } else {
        let response = await db.query("SELECT * FROM notes WHERE cover_id=$1 ORDER BY id;", [targetBook.cover_i]);
        let noteEntries = response.rows;
        const t = new Date(Date.now()).toISOString();

        response = await db.query(
            "UPDATE notes SET description=$1, updated_time=$2 WHERE id=$3;",
            [req.body.note, t, noteEntries[0].id]
        );

        queryResultsGlobal = [];
        targetBook = {};

        res.redirect("/");
    }
});

app.get("/editmain", async (req, res) => {
    let noteEntry = noteEntriesGlobal[req.query.idx];

    targetBook = new Book(noteEntry.cover_id, noteEntry.book_name, noteEntry.author);

    res.redirect("/edit");
});

app.post("/delete", async (req, res) => {
    if (!isEmpty(targetBook)) {
        let response = await db.query("SELECT * FROM notes WHERE cover_id=$1 ORDER BY id;", [targetBook.cover_i]);
        let noteEntries = response.rows;

        response = await db.query("DELETE FROM notes WHERE id=$1;", [noteEntries[0].id]);

        queryResultsGlobal = [];
        targetBook = {};
    }

    res.redirect("/");
});

app.post("/deletemain", async (req, res) => {
    let noteEntry = noteEntriesGlobal[req.query.idx];

    targetBook = new Book(noteEntry.cover_id, noteEntry.book_name, noteEntry.author);

    res.redirect(307, "/delete");
});

app.listen(port, () => {console.log(`Server running on port ${port}`);});