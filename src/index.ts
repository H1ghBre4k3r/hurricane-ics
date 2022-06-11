import express from "express";

const router = express();

router.get("/", (_, res) => {
    res.send("Hello, world!");
});

router.listen(3000, () => {
    console.log("Started listening...");
});
