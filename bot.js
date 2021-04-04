import config from "./config.json";
import Bot from "ttapi";
import prettyMilliseconds from "pretty-ms";
import * as path from "path";
import * as fs from "fs";
import slugify from "slugify";
import mkdirp from "mkdirp";
import youtubedl from "youtube-dl-exec";
import hasbin from "hasbin";

const startTime = Date.now();
let snags = 0;

class TurntableScaper {

    room;

    downloads = 0;

    async start() {


        await new Promise(((resolve, reject) => {
            hasbin.all(['youtube-dl', 'ffmpeg'], (result) => {
                if (result) {
                    resolve();
                }
                reject('Missing dependencies');
            })
        }))

        const loggedEvents = [];

        console.log(`Turntable Scraper`);

        const bot = new Bot(config.authKey, config.userId);

        loggedEvents.forEach((eventName) => {
            bot.on(eventName, (data) => {
                console.log(eventName, data);
            });
        });

        bot.on('pmmed', ({text, senderid}) => {
            if (text.startsWith('uptime')) {
                bot.pm(`I have been online for ${(prettyMilliseconds(Date.now() - startTime))}`, senderid)
            } else if (text.startsWith('snags')) {
                bot.pm(`I have downloaded ${this.downloads} songs.`, senderid);
            }
        });

        bot.on('ready', () => {
            bot.roomRegister(config.roomId);
        });

        bot.on('roomChanged', ({room}) => {
            this.room = room;
            console.log(`Joined ${room.name}`);
        });

        bot.on('newsong', async ({room}) => {
            const currentSong = room.metadata.current_song;
            const roomName = this.room.name;

            console.log(`New song: ${currentSong.metadata.song} - ${currentSong.metadata.artist}`)

            const fileName = `${slugify(currentSong.metadata.artist, {
                strict: true,
                replacement: "_"
            })}-${slugify(currentSong.metadata.song, {
                strict: true,
                replacement: "_"
            })}.m4a`;


            const defaultPath = path.join(__dirname, "downloads");
            const filePath = path.join(config.downloadPath ? config.downloadPath : defaultPath, roomName, fileName);

            const cwd = path.dirname(filePath);

            await mkdirp(cwd);

            console.log(`Saving to: ${filePath}`);

            const startDownloadTime = Date.now();

            if (fs.existsSync(filePath)) {
                console.log(`File already exists, skipping!`);
                return;
            }

            let url;
            if (currentSong.source === 'sc') {
                url = `https://api.soundcloud.com/tracks/${currentSong.sourceid}/download`
            } else if(currentSong.source === 'yt') {
                url = `http://youtube.com/watch?v=${currentSong.sourceid}`
            } else {
                console.log(`Unable to identify url for source ${currentSong.source}`);
                return;
            }

            console.log(`Working with: ${url}`);

            await youtubedl(url, {
                noCallHome: true,
                printJson: true,
                extractAudio: true,
                audioFormat: 'm4a',
                audioQuality: 0,
                noCheckCertificate: true,
                output: fileName
            }, {
                cwd
            })

            console.log(`Finished in ${prettyMilliseconds(Date.now() - startDownloadTime)}`)

            bot.bop();
            this.downloads++;
        });
    }
}

const scraper = new TurntableScaper();
scraper.start();
