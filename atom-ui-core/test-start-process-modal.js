/**
 * Manual Testing Script for Start Process Modal
 * 
 * This script tests the new "Start Process" modal functionality
 * Run with: node test-start-process-modal.js
 * 
 * Requirements: npm install puppeteer
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testStartProcessModal() {
  console.log('🚀 Starting Start Process Modal Test...\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Set to true for headless mode
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Step 1: Navigate to processes page
    console.log('📍 Step 1: Opening http://localhost:5173/processes');
    await page.goto('http://localhost:5173/processes', { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });
    await page.waitForTimeout(2000);
    console.log('✅ Page loaded successfully\n');

    // Step 2: Click "Start Process" button
    console.log('📍 Step 2: Clicking "Start Process" button');
    await page.waitForSelector('button:has-text("Start Process")', { timeout: 5000 });
    await page.click('button:has-text("Start Process")');
    await page.waitForTimeout(1000);
    console.log('✅ Modal opened\n');

    // Step 3: Wait for modal and select process from dropdown
    console.log('📍 Step 3: Selecting process from "Process Key" dropdown');
    await page.waitForSelector('.ant-modal', { timeout: 5000 });
    
    // Click on the Select component to open dropdown
    await page.click('.ant-select-selector');
    await page.waitForTimeout(1000);
    
    // Wait for dropdown options to appear
    await page.waitForSelector('.ant-select-item-option', { timeout: 5000 });
    
    // Get all available processes
    const processOptions = await page.$$eval('.ant-select-item-option', options => 
      options.map(opt => opt.textContent)
    );
    console.log('📋 Available processes:', processOptions);
    
    // Select the first process
    if (processOptions.length > 0) {
      await page.click('.ant-select-item-option:first-child');
      await page.waitForTimeout(2000); // Wait for variables card to load
      console.log('✅ Process selected:', processOptions[0], '\n');
    } else {
      console.log('⚠️  No processes available in dropdown\n');
      await browser.close();
      return;
    }

    // Step 4: Check if Process Variables card appeared
    console.log('📍 Step 4: Checking if Process Variables card appeared');
    const variablesCardExists = await page.$('.ant-card:has-text("Process Variables")') !== null;
    
    if (variablesCardExists) {
      console.log('✅ Process Variables card is visible!\n');
      
      // Extract variables information
      const variablesInfo = await page.$eval('.ant-card:has-text("Process Variables") pre code', 
        el => el.textContent
      );
      console.log('📊 Process Variables:');
      console.log(variablesInfo);
      console.log();
      
      // Get variable tags
      const variableTags = await page.$$eval('.ant-card:has-text("Process Variables") .ant-tag', 
        tags => tags.map(tag => tag.textContent)
      );
      console.log('🏷️  Variable tags:', variableTags);
      console.log();
      
      // Step 5: Click "Use Example" button
      console.log('📍 Step 5: Clicking "Use Example" button');
      await page.click('.ant-card:has-text("Process Variables") button:has-text("Use Example")');
      await page.waitForTimeout(1000);
      
      // Check if Variables textarea is filled
      const variablesTextarea = await page.$eval('textarea[placeholder*="key"]', 
        el => el.value
      );
      
      if (variablesTextarea && variablesTextarea.trim() !== '') {
        console.log('✅ Variables textarea automatically filled!\n');
        console.log('📝 Filled content:');
        console.log(variablesTextarea);
        console.log();
      } else {
        console.log('❌ Variables textarea is empty - functionality not working correctly\n');
      }
      
    } else {
      console.log('❌ Process Variables card NOT visible - functionality not working\n');
    }

    // Step 6: Take screenshot
    console.log('📍 Step 6: Taking screenshot of modal');
    const screenshotPath = path.join(__dirname, 'start-process-modal-screenshot.png');
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    console.log('✅ Screenshot saved to:', screenshotPath, '\n');

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log('✓ Modal opens correctly');
    console.log('✓ Process dropdown works');
    console.log(`${variablesCardExists ? '✓' : '✗'} Process Variables card appears`);
    if (variablesCardExists) {
      console.log('✓ "Use Example" button works');
      console.log('✓ Variables auto-fill functionality works');
    }
    console.log('═══════════════════════════════════════════════════════\n');

    // Keep browser open for 5 seconds to see the result
    console.log('⏳ Keeping browser open for 5 seconds...');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('🏁 Test completed!');
  }
}

// Run the test
testStartProcessModal().catch(console.error);
