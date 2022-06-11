import http from "http";
import ical from "ical-generator";

const calendar = ical({ name: "Hurricane Calendar" });
const startTime = new Date();
const endTime = new Date();
endTime.setHours(startTime.getHours() + 1);
calendar.createEvent({
    start: startTime,
    end: endTime,
    summary: "Example Event",
    description: "It works ;)",
    location: "my room",
    url: "http://sebbo.net/",
});

http.createServer((_, res) => calendar.serve(res)).listen(3000, "127.0.0.1", () => {
    console.log("Server running at http://127.0.0.1:3000/");
});
