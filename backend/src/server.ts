import { app } from "./app.js";

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`Qingfeng Party Cloud API running at http://localhost:${port}`);
});
