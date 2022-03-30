#!/usr/bin/env node
const net = require('net');
const server = net.createServer((c) => {
   c.on('error', (err) => {
      console.log('Logging an error');
   })
});

let clients = {};

const surveyResponseModel = {
1: `Output:\n  Starting the survey\n  type: text\n  value: What is your name?\nInput:`,
2: `Output:\n  type: radio\n  value: what is your gender?\n  options: [Male, Female]\nInput:`,
3: `Output:\n  type: checkbox\n  value: what are your hobbies?\n  options: [Fishing, Cooking, Swimming]\nInput:`
};

const signinPage = `HTTP/1.1 200 OK
Content-Type: text/html

<html><head>
   <h3>Sign in</h3>
   <form action=/signin method="post">
      Username: <input type = "text" name = "username" value = ""><br>
      <input type="submit" value="Log in">
   </form>
</head></html>
`;

const notFoundPage = `HTTP/1.1 404
Content-Type: text/html

<html><head>
<h1>Page not Found</h1>
<p>Please <a href="/signin">sign in</a></p>
</head></html>
`;

server.on('connection', handleConnection);
server.listen(8000, function () {
   console.log('listening...');
});

const getUrl = (data) => {
   return data.split('\n')[0].split(' ')[1];
}

const getHttpMethod = (data) => {
   return data.split('\n')[0].split(' ')[0];
}

const redirect = (slug) => {
   return `HTTP/1.1 303 See Other
Location: http://localhost:8000/${slug}`;
}

const validateFirstInput = (input, path) => {
   if(input.toLowerCase() === 'start survey') {
      clients[path].output += `\n${input}\n${surveyResponseModel[clients[path].step]}`;
   }
   else {
      clients[path].output += `\n${input}\nPlease enter "start survey" to start the survey.\nInput:`;
      clients[path].step--;
   }
}

const selectGender = (input, path) => {
   if(input.toLowerCase() === 'male' || input.toLowerCase() === 'female') {
      clients[path].gender = input;
      clients[path].output += `\n${input}\n${surveyResponseModel[clients[path].step]}`;
   }
   else {
      clients[path].output += `\n${input}\nPlease enter from one of the choices.\n${surveyResponseModel[clients[path].step-1]}`;
      clients[path].step--;
   }
}  

const selectHobbies = (input, path) => {
   const hobbySelection = ['fishing', 'cooking', 'swimming'];
   let isHobbyValid = input.split(',').every((hobby) => {
       return hobbySelection.includes(hobby.trim().toLowerCase());
   });

   if(isHobbyValid) {
       clients[path].hobbies = input;
       clients[path].output += `\n${input}\nOutput:\nA ${clients[path].gender} ${clients[path].name} who likes ${clients[path].hobbies}.`;
   }
   else {
      clients[path].output += `\n${input}\nPlease enter from one of the choices.\n${surveyResponseModel[clients[path].step-1]}`;
      clients[path].step--;
   }
}

const handleSurveyFlow = (surveyAnswer, path) => {
   switch(clients[path].step) {
      case 1:
         validateFirstInput(surveyAnswer, path);
         break;
      case 2:
         clients[path].name = surveyAnswer;
         clients[path].output += `\n${surveyAnswer}\n${surveyResponseModel[clients[path].step]}`;
         break;
      case 3:
         selectGender(surveyAnswer, path);
         break;
      case 4:
         selectHobbies(surveyAnswer, path);
         break;
   }
}

const storeClient = (userName) => {
   if(!(userName in clients)) {
      clients[userName] = {};
      clients[userName].step = 1;
      clients[userName].output = 'Input: ';
   } 
}

const handlePostRequest = (url, data) => {
   let clientInput = getClientInput(data);
   if(url === '/signin') {
        storeClient(clientInput);
        return redirect(`input/${clientInput}`); 
   }
   else if(url.match(/\/input.*/g)) {
      let path = url.split('/')[2];
      handleSurveyFlow(clientInput, path);
      clients[path].step++;
      return redirect(`input/${path}`);
   }
}

const handleGetRequest = (url, data) => {
   if(url === '/signin' || url === '/homepage' || url === '/') {
      return signinPage;
   }
   else if(url.match(/\/input.*/g)) {
      let path = url.split('/')[2];
      return `HTTP/1.1 200 OK
      Content-Type: text/html

      <html><head>
      <h3>Survey App</h3>
      <textarea style="width: 500px; height: 500px;">${clients[path].output}</textarea><br>
      <form style="margin-top: 10px" action=/input/${path} method="post">
         Input: <input type = "text" name = "client-input" value = "">
         <input type="submit" value="submit">
      </form>
      </head></html>
      `;
   }
   else {
      return notFoundPage;
   }
}

const handleHttpMethod = (data) => {
   let httpMethod = getHttpMethod(data);
   let url = getUrl(data);

   if(httpMethod === 'GET') {
      return handleGetRequest(url, data);
   }
   else if (httpMethod === 'POST') {
      return handlePostRequest(url, data);
   }
}

const getClientInput = (data) => {
   let dataArray = data.split('\n');
   let surveyAnswer = dataArray[dataArray.length-1].split('=')[1];
   return removeExcessCharacters(surveyAnswer);
}

const removeExcessCharacters = (str) => {
   const spaceRegex = /\+/g;
   const commaRegex = /\%2C/g;
   const newStr = str.replace(spaceRegex, " ").replace(commaRegex, ",");
   return newStr;
}

function handleConnection(client) {
   client.setEncoding('utf8');
   client.on('data', onReceiveData);
   client.once('close', onConnClose);

   function onReceiveData(data) {
      const serverResponse = handleHttpMethod(data);
      
      client.write(serverResponse);
      client.end();
   }

   function onConnClose() {
      console.log('connection closed');
   }
}
