import { neru, Messages, Scheduler, Voice } from 'neru-alpha';
import express from 'express';

const app = express();
const port = process.env.NERU_APP_PORT;

const session = neru.createSession();
const voice = new Voice(session);

const contact = JSON.parse(process.env.NERU_CONFIGURATIONS).contact;

await voice.onVapiAnswer('onCall').execute();

async function chargeCard() {
	return new Promise((resolve) => {
        setTimeout(resolve, 3 * 1000);
  });
}

app.use(express.json()); 

app.get('/_/health', async (req, res) => {
    res.sendStatus(200);
});

app.post('/onCall', async (req, res, next) => {
    try {
        const session = neru.createSession(); 
        const voice = new Voice(session); 
        const messaging = new Messages(session);
        const state = session.getState();

        await voice.onVapiEvent({ vapiUUID: req.body.uuid, callback: 'onEvent' }).execute();
        await messaging.listenMessages(
            { type: "sms", number: req.body.from }, 
            { type: "sms", number: contact.number },
            'onMessage'
        ).execute(); 
        await state.set("calldata", {
            callUUID: req.body.uuid,
            flowState: 'parkid'
        });

        res.json([
            {
                action: 'talk',
                text: 'Welcome to VonagePark, enter the car park ID, followed by a hash to continue',
                bargeIn: true
            },
            {
                action: 'input',
                type: ['dtmf'],
                dtmf: {
                    timeOut: '10',
                    submitOnHash: true
                }
            }
        ]);
    } catch (error) {
        next(error);
    }
});

app.post('/onEvent', async (req, res, next) => {
    try {
        if (req.body.dtmf != null) {
            const session = neru.getSessionFromRequest(req);
            const state = session.getState();
            const messaging = new Messages(session);
            
            const from = req.body.from;
            const to = { type: "sms", number: from };
            const vonageNumber = { type: "sms", number: contact.number }; 

            const digits = req.body.dtmf.digits;
            const data = await state.get("calldata");

            switch (data.flowState) {
                case 'parkid':
                    data.flowState = 'duration';
                    data.parkingID = digits;
                    await state.set("calldata", data);

                    res.json([
                        {
                            action: 'talk',
                            text: `You are parking at ${digits}. Press a digit to choose how many hours you want to pay for.`,
                            bargeIn: true
                        },
                        {
                            action: 'input',
                            type: ['dtmf'],
                            dtmf: {
                                timeOut: '10',
                                submitOnHash: true
                            }
                        }
                    ]);
                    break;

                case 'duration':
                    data.flowState = 'reg';
                    data.duration = digits;
                    await state.set("calldata", data);
                    await messaging.sendText(
                        vonageNumber,
                        to,
                        `Please reply with your car's registration number`
                    ).execute();

                    res.json([
                        {
                            action: 'talk',
                            text: `You will receive a text from this number, reply with your car's registration number.`
                        },
                        {
                            action: 'stream',
                            streamUrl: ["https://onhold2go.co.uk/song-demos/free/a-new-life-preview.mp3"], 
                            loop: "0"
                        }
                    ]);
                    break;

                case 'pay':
                    const scheduler = new Scheduler(session);

                    await chargeCard();
            
                    await messaging.sendText(
                        vonageNumber,
                        to,
                        `You are parking at ${data.parkingID} and have paid for ${data.duration} hours.`
                    ).execute();

                    const endTime = new Date(new Date().setHours(new Date().getHours() + parseInt(data.duration)));
                    const testTime = new Date(new Date().setSeconds(new Date().getSeconds() + 20));

                    scheduler.startAt({
                        startAt: testTime,
                        callback: 'parkingReminder',
                        payload: {
                            from: from,
                        }
                    }).execute();

                    res.json([
                        {
                            action: 'talk',
                            text: `Your card has been charged for ${data.duration} hours. You will receive a text confirmation and a reminder when your parking is about to expire`,
                        }
                    ]);
                    break;
            }

        } else {
            console.log(req.body)
        }
    } catch (error) {
        next(error);
    }
});

app.post('/onMessage', async (req, res, next) => {
    try {
        const session = neru.getSessionFromRequest(req)
        const state = session.getState(); 
        const data = await state.get("calldata");

        data.flowState = 'pay';
        data.reg = req.body.message.content.text;
        await state.set('calldata', data );

        await voice.uploadNCCO(data.callUUID, 
            {
                "action": "transfer",
                "destination": {
                  "type": "ncco",
                  "ncco": [
                    {
                        action: 'talk',
                        text: `You've registered the car ${data.reg}. Enter your card number followed by a hash to pay.`,
                        bargeIn: "true"
                    },
                    {
                        action: 'input',
                        type: ['dtmf'],
                        dtmf: {
                            timeOut: '10',
                            submitOnHash: "true"
                        }
                    }
                  ]
                }
            }
        ).execute();
        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

app.post('/parkingReminder', async (req, res, next) => {
    try {
        const session = neru.getSessionFromRequest(req)
        const state = session.getState();
        const messaging = new Messages(session);

        const from = req.body.from;
        const data = await state.get("calldata");

        const to = { type: "sms", number: from };
        const vonageNumber = { type: "sms", number: contact.number }; 

        await messaging.sendText(
            vonageNumber,
            to,
            `Your parking at ${data.parkingID} is about to run out.`
        ).execute();
 
        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
});