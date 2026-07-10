import ftp from 'basic-ftp';
import fs from 'fs';

async function testFtpConnection() {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
        console.log("Connecting to FTP...");
        await client.access({
            host: "216.70.82.104",
            user: "ACX1110",
            password: "k91859tW081N9I39Hn1W",
            secure: false
        });
        console.log("Connected successfully!");
        
        console.log("Listing files in root directory:");
        const list = await client.list();
        console.log(list.map(f => f.name).join('\n'));

    }
    catch(err) {
        console.error("FTP Connection failed:", err);
    }
    finally {
        client.close();
    }
}

testFtpConnection();
