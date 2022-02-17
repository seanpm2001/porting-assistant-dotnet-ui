import os from "os";
import path from "path";
import fs, { promises as fsPromises } from "fs";
import readline from "readline";
import events from "events";
import { app } from "electron";

interface Credentials {
  aws_access_key_id: string;
  aws_secret_access_key: string;
}

export async function writeProfile(
  profileName: string,
  credentials: Credentials
) {
  if (!fs.existsSync(path.join(getHomeDir(), ".aws"))) {
    await fsPromises.mkdir(path.join(getHomeDir(), ".aws"));
  }
  if (!fs.existsSync(getDefaultFilePath())) {
    await fsPromises.writeFile(getDefaultFilePath(), "");
  }
  const { aws_access_key_id, aws_secret_access_key } = credentials;
  const profile = `${os.EOL}[${profileName}]${os.EOL}aws_access_key_id = ${aws_access_key_id}${os.EOL}aws_secret_access_key = ${aws_secret_access_key}${os.EOL}`;
  await fsPromises.appendFile(getDefaultFilePath(), profile);
}

function getDefaultFilePath() {
  return path.join(getHomeDir(), ".aws", "credentials");
}

function getHomeDir() {
  var env = process.env;
  var home =
    env.HOME ||
    env.USERPROFILE ||
    (env.HOMEPATH ? (env.HOMEDRIVE || "C:/") + env.HOMEPATH : null);

  if (home) {
    return home;
  }

  if (typeof os.homedir === "function") {
    return os.homedir();
  }
  throw new Error("Cannot load credentials, HOME path not set");
}

export function getTodaysDate(): string {
  // we want a local datetime in format YYYYmmdd, en-CA happens to work
  return new Date().toLocaleDateString("en-CA").slice(0, 10).replace(/-/g, "");
}

export async function searchTextInFile(
  file: string,
  targetText: string
): Promise<boolean> {
  let targetTextFound = false;
  const rl = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });
  rl.on("line", (line) => {
    if (line.includes(targetText)) {
      targetTextFound = true;
      rl.close();
      rl.removeAllListeners();
    }
  });
  await events.once(rl, "close");
  return targetTextFound;
}
