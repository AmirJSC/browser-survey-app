#!/usr/bin/env node

const net = require('net');
const server = net.createServer((c) => {
   c.on('error', (err) => {
      console.log('Logging an error');
   })
});

let hasSurveyStarted, name, gender, hobbies, homePage;
let output = 'Input: ';
let clients = {};
let step = 1;

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
</head></html>
`;
const pageModel = {homePage, notFoundPage, signinPage};

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

const redefineHomePage = () => {
   
   pageModel.homePage = `HTTP/1.1 200 OK
Content-Type: text/html

<html><head>
<h3>Survey App</h3>
<textarea style="width: 500px; height: 500px;">${output}</textarea><br>
<form style="margin-top: 10px" action=/input method="post">
   Input: <input type = "text" name = "client-input" value = "">
   <input type="submit" value="submit">
</form>
</head></html>
`;
}

const validateFirstInput = (input) => {
   if(input.toLowerCase() === 'start survey') {
      output += `\n${input}\n${surveyResponseModel[step]}`;
   }
   else {
      output += `\n${input}\nPlease enter "start survey" to start the survey.\nInput:`;
      step--;
   }
}

const selectGender = (input) => {
   if(input.toLowerCase() === 'male' || input.toLowerCase() === 'female') {
      gender = input;
      output += `\n${input}\n${surveyResponseModel[step]}`;
   }
   else {
      output += `\n${input}\nPlease enter from one of the choices.\n${surveyResponseModel[step-1]}`;
      step--;
   }
}  

const selectHobbies = (input) => {
   const hobbySelection = ['fishing', 'cooking', 'swimming'];
   let isHobbyValid = input.split(',').every((hobby) => {
       return hobbySelection.includes(hobby.trim().toLowerCase());
   });

   if(isHobbyValid) {
       hobbies = input;
       output += `\n${input}\nOutput:\nA ${gender} ${name} who likes ${hobbies}.`;
   }
   else {
       output += `\n${input}\nPlease enter from one of the choices.\n${surveyResponseModel[step-1]}`;
       step--;
   }
}

const handleSurveyFlow = (surveyAnswer) => {
   switch(step) {
      case 1:
         validateFirstInput(surveyAnswer);
         break;
      case 2:
         name = surveyAnswer;
         output += `\n${surveyAnswer}\n${surveyResponseModel[step]}`;
         break;
      case 3:
         selectGender(surveyAnswer);
         break;
      case 4:
         selectHobbies(surveyAnswer);
         break;
   }
}

const handleSignin = (userName) => {
   if(!(userName in clients)) {
      clients[userName] = {};
      clients[userName].step = 1;
      clients[userName].output = 'Input: ';
   }
    
}

const handlePostRequest = (url, data) => {
   let clientInput = getClientInput(data);
   if(url === '/signin') {
        handleSignin(clientInput);
        return redirect('homepage'); 
   }
   else if(url === '/input') {
      handleSurveyFlow(clientInput);
      step++;
      return redirect('homepage');
   }
}

const handleGetRequest = (url) => {
   if(url === '/homepage' || url === '/') {
      return pageModel.homePage;
   }
   else if(url === '/signin') {
      return pageModel.signinPage;
   }
   else {
      return pageModel.notFoundPage;
   }
}

const handleHttpMethod = (data) => {
   let httpMethod = getHttpMethod(data);
   let url = getUrl(data);
   redefineHomePage();

   if(httpMethod === 'GET') {
      return handleGetRequest(url);
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
      // console.log(Object.keys(clients).length);
      console.log(data);
   
      const serverResponse = handleHttpMethod(data);
      
      console.log(step);
      client.write(serverResponse);
      client.end();
   }

   function onConnClose() {
      console.log('connection closed');
   }
}
