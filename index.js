import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import { config } from "dotenv";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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
    let queryResultsCoverId = [];
    if (Object.hasOwn(req.query, 'q')) {queryText = req.query.q;}
    if (queryText !== "") {
        response = await axios.get(`https://openlibrary.org/search.json?q=${queryText}&limit=5`);
        queryResults = response.data.docs
        // console.log(queryResults[0].cover_i);
    }
    queryResults.forEach((elem) => {queryResultsCoverId.push(elem.cover_i);});
    res.render("main.ejs", {
        title: "Book Notes", activeTab: "home", queryText: queryText, queryResults: queryResults, 
        queryResultsCoverIdJSON: JSON.stringify(queryResultsCoverId), noteEntries: noteEntries
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});