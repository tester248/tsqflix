import ShowboxAPI from './ShowboxAPI.js';
import FebBoxApi from './FebBoxApi.js';

const showbox = new ShowboxAPI({});
const febbox = new FebBoxApi({});

async function test() {
    // 1. Search for "Breaking Bad"
    const searchRes = await showbox.search('Breaking Bad', 2);
    console.log("Search:", searchRes[0]);
    if (!searchRes[0]) return;

    const tid = searchRes[0].id;
    console.log("Show ID:", tid);

    const shareKey = await showbox.getFebBoxId(tid, 2);
    console.log("Share Key:", shareKey);

    if (shareKey) {
        const files = await febbox.getFileList(shareKey, 0);
        console.log("Root files:", files.slice(0, 2));

        if (files.length > 0 && files[0].is_dir) {
            const epFiles = await febbox.getFileList(shareKey, files[0].fid);
            console.log("Episode files:", epFiles.slice(0, 2));
        }
    }
}
test();
