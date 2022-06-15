import React, { useEffect, useState } from "react";
import "./App.css";
import { FestivalPlan } from "./types";

const App = () => {
    const [festival, setFestival] = useState<FestivalPlan>();

    useEffect(() => {
        fetch("/api/concerts")
            .then((val) => val.json())
            .then((val) => setFestival(val));
    }, [setFestival]);

    return <div>{JSON.stringify(festival)}</div>;
};

export default App;
