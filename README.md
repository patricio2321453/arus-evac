<!-- markdownlint-disable MD033 MD041 MD045-->

<div align=center>

<a href="">
  <img src="public/aru-girl-failure.png" width="192" height="192">
</a>

<h1>Arus Evac</h1>

<strong>Evacuation planning through scenario-based simulation.</strong>

<img src="/Screenshot_20260213_220116.png">

</div>

<!-- markdownlint-restore -->

## About The Project

Arus Evac is an evacuation planning tool that helps planners review and explore evacuation plans through simulated scenarios. It models the full evacuation cycle, including evacuation, shelter stays, and the return of residents to their homes.

The tool is designed to provide insights rather than exact or authoritative results. For example, selecting a public school as an evacuation site can illustrate potential impacts such as the number of students whose education may be disrupted, estimated shelter occupancy, and the surrounding areas likely to be served by that shelter. Users may input their own data when available. When data is missing, the system may rely on clearly indicated assumptions.

> [!IMPORTANT]
> Arus Evac functions as a decision-support tool and does not replace professional judgment. Any assumptions, estimates, or simulated outcomes are illustrative in nature. **Responsibility for planning decisions and their real-world outcomes remains with the user.**

## Getting Started

This guide helps you set up your local development environment so you can start working quickly.

> [!TIP]
> If you want deeper explanations (why tools are needed, what commands do, troubleshooting), see: (TBA)

## Supported Environments

This project is developed primarily on Linux.

Supported environments:

- Linux (recommended)
- Windows 11 (supported with extra setup)
- Windows + WSL (treated as Linux)

> [!NOTE]
> Some tools assume a Linux-like environment.
> On Windows, follow this guide carefully.

## Windows Setup

> [!IMPORTANT]
> Ensure all commands are executed strictly within a non-administrative instance of PowerShell 7. Avoid the use of Administrator privileges unless explicitly directed otherwise.

### Prerequisites (Windows)

- PowerShell 7 – the terminal used in this guide
- Scoop – installs tools consistently
- Git – downloads and manages the project
- Node.js v24 (LTS) – required to run the project

### Installation

#### Install PowerShell 7

PowerShell 7 is not included by default with Windows.

Follow this guide from [Microsoft](https://learn.microsoft.com/en-us/powershell/scripting/install/install-powershell-on-windows?view=powershell-7.5).

#### Install Scoop

Run in PowerShell 7:

```sh
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
```

#### Install Git

Git is installed automatically by Scoop.

If Git is not found, install it:

```sh
scoop install git
```

#### Configure Git

Tell Git who you are:

```sh
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

Example:

```sh
git config --global user.name "Prinz Edward Ducyogen"
git config --global user.email "ducyogenpred@gmail.com"
```

#### Install Node.js (Required)

This project requires **Node.js v24 (LTS)**.

Install:

```sh
scoop install nodejs-lts
```

You should see version numbers printed.

#### Choose Project Location (Optional)

Move to your home directory:

```sh
cd ~
pwd
```

You should see something like:

```sh
C:\Users\YourUsername
```

#### Clone the Project

```sh
git clone https://github.com/edwardducy/arus-evac.git
cd arus-evac
```

#### Install Dependencies

Confirm you’re in the correct folder:

```sh
ls
```

You should see:

- package.json
- package-lock.json

Install dependencies:

```sh
npm install
```

#### Start the Development Server

```sh
npm run dev
```

<!-- markdownlint-disable MD026  -->

## To Be Continued...

<!-- markdownlint-enable -->


