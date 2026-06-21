// frontend/src/pages/AdminProducts.jsx
import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import ExcelJS from 'exceljs';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';

const AdminProducts = () => {
  const { userInfo } = useContext(AuthContext);
  const { showConfirm } = useContext(ToastContext);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // New States for Category Conversion and Image URL Update
  const [allProductsUnpaginated, setAllProductsUnpaginated] = useState([]);
  const [imageInputs, setImageInputs] = useState({});
  const [sourceCategory, setSourceCategory] = useState('');
  const [targetCategory, setTargetCategory] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const handleCopyText = async (productId, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(productId);
      setTimeout(() => setCopiedId(null), 1200);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  // Pagination, Search, Tab, and Sort States
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalFilteredProducts, setTotalFilteredProducts] = useState(0);
  const [tab, setTab] = useState('all'); // 'all', 'manual', 'bulk', 'convert_cat', 'image_update'
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState('1'); // Default: Latest Upload First
  const [allCount, setAllCount] = useState(0);
  const [manualCount, setManualCount] = useState(0);
  const [bulkCount, setBulkCount] = useState(0);

  // Bulk Product Upload States
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState({
    totalRows: 0,
    importedCount: 0,
    updatedCount: 0,
    duplicateCount: 0,
    failedCount: 0,
    failedRows: [],
    duplicateRows: []
  });

  // Compile categories list dynamically
  const uniqueCategories = React.useMemo(() => {
    const defaults = [
      'Dairy & Milk Products',
      'Home Essentials',
      'Fruits & Vegetables',
      'Personal Care Products',
      'Kitchen Essentials'
    ];
    const fromProducts = allProductsUnpaginated.map(p => p.category).filter(Boolean);
    return Array.from(new Set([...defaults, ...fromProducts])).sort();
  }, [allProductsUnpaginated]);

  // Categories present in database only (no empty ones)
  const activeCategoriesOnly = React.useMemo(() => {
    const fromProducts = allProductsUnpaginated.map(p => p.category).filter(Boolean);
    return Array.from(new Set(fromProducts)).sort();
  }, [allProductsUnpaginated]);

  // Check if image URL is empty or placeholder
  const isUrlEmpty = (url) => {
    if (!url) return true;
    const lowerUrl = url.toLowerCase();
    return lowerUrl === '' || lowerUrl.includes('placeholder') || lowerUrl.includes('unsplash.com/photo-1542838132-92c53300491e');
  };

  // Extract direct image URL from Google Search Links
  const extractRealImageUrl = (url) => {
    if (!url) return '';
    let trimmed = String(url).trim();
    if (trimmed.includes('google.com/imgres')) {
      try {
        const urlObj = new URL(trimmed);
        const imgurlParam = urlObj.searchParams.get('imgurl');
        if (imgurlParam) {
          return decodeURIComponent(imgurlParam);
        }
      } catch (e) {
        const match = trimmed.match(/[?&]imgurl=([^&]+)/);
        if (match && match[1]) {
          return decodeURIComponent(match[1]);
        }
      }
    }
    return trimmed;
  };


  // Sorted and searched list for fast image url updates
  const imageUpdateProductsList = React.useMemo(() => {
    let list = [...allProductsUnpaginated];
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      list = list.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) || 
        (p.brand && p.brand.toLowerCase().includes(q)) || 
        (p.category && p.category.toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => {
      const aEmpty = isUrlEmpty(a.image);
      const bEmpty = isUrlEmpty(b.image);
      if (aEmpty && !bEmpty) return -1;
      if (!aEmpty && bEmpty) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [allProductsUnpaginated, search]);


  const parseCSVText = (text) => {
    const lines = [];
    let row = [""];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i+1];
      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',') {
        if (inQuotes) {
          row[row.length - 1] += c;
        } else {
          row.push("");
        }
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && next === '\n') {
          i++;
        }
        if (inQuotes) {
          row[row.length - 1] += '\n';
        } else {
          lines.push(row);
          row = [""];
        }
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 1 || row[0] !== "") {
      lines.push(row);
    }
    return lines;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileType = file.name.split('.').pop().toLowerCase();
    if (fileType !== 'csv' && fileType !== 'xlsx') {
      alert('Only CSV (.csv) and Excel (.xlsx) file formats are supported.');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      let headers = [];
      let rows = [];

      if (fileType === 'csv') {
        const text = await file.text();
        const parsedLines = parseCSVText(text);
        
        if (parsedLines.length === 0) {
          throw new Error('The uploaded CSV file is empty.');
        }

        headers = parsedLines[0].map(h => h.trim());
        const dataLines = parsedLines.slice(1).filter(line => line.some(cell => cell.trim() !== ''));
        
        rows = dataLines.map(line => {
          const rowObj = {};
          headers.forEach((header, index) => {
            rowObj[header] = line[index] !== undefined ? line[index] : '';
          });
          return rowObj;
        });
      } else if (fileType === 'xlsx') {
        const workbook = new ExcelJS.Workbook();
        const arrayBuffer = await file.arrayBuffer();
        await workbook.xlsx.load(arrayBuffer);
        const worksheet = workbook.getWorksheet(1);

        if (!worksheet) {
          throw new Error('No worksheets found in the Excel file.');
        }

        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell) => {
          headers.push(String(cell.value || '').trim());
        });

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const rowObj = {};
          let hasValue = false;
          
          headers.forEach((header, colIndex) => {
            const cell = row.getCell(colIndex + 1);
            let val = cell.value;
            if (val && typeof val === 'object') {
              if (val.richText) {
                val = val.richText.map(t => t.text).join('');
              } else if (val.text) {
                val = val.text;
              } else if (val.result !== undefined) {
                val = val.result;
              } else {
                val = '';
              }
            }
            rowObj[header] = val !== undefined && val !== null ? String(val) : '';
            if (rowObj[header].trim() !== '') {
              hasValue = true;
            }
          });

          if (hasValue) {
            rows.push(rowObj);
          }
        });
      }

      setUploadProgress(40);

      const requiredCols = [
        'Product Name',
        'Brand Name',
        'Category',
        'Catalog Display Rating',
        'GST Rate',
        'Pack Size',
        'Selling Price',
        'Stock Quantity'
      ];

      const missingCols = requiredCols.filter(col => !headers.includes(col));
      if (missingCols.length > 0) {
        throw new Error(`Missing required columns in header: ${missingCols.join(', ')}`);
      }

      setUploadProgress(60);

      const config = {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.token}`,
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(60 + Math.round(percentCompleted * 0.3));
        }
      };

      const { data } = await axios.post('/api/admin/products/bulk', { headers, rows }, config);

      setUploadProgress(100);

      setSummaryData({
        totalRows: data.totalRows,
        importedCount: data.importedCount,
        updatedCount: data.updatedCount || 0,
        duplicateCount: data.duplicateCount,
        failedCount: data.failedCount,
        failedRows: data.failedRows,
        duplicateRows: data.duplicateRows
      });

      setShowSummaryModal(true);
      fetchInventoryGrid();

      if (data.failedCount === 0 && (data.updatedCount || 0) > 0) {
        alert(`🎉 Bulk import completed! Created ${data.importedCount} new products and updated stock for ${data.updatedCount} existing products.`);
      } else if (data.failedCount === 0 && data.duplicateCount === 0) {
        alert('🎉 All products imported successfully with zero errors!');
      } else {
        alert('⚠️ Bulk import completed with warnings or errors. Please check the summary modal.');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      e.target.value = '';
    }
  };

  const downloadSampleTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sample Template');

      const headers = [
        'Product Name',
        'Brand Name',
        'Category',
        'Catalog Display Rating',
        'GST Rate',
        'Product Image URL',
        'Product Description',
        'Pack Size',
        'Original Price',
        'Selling Price',
        'Stock Quantity'
      ];

      worksheet.addRow(headers);
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF10B981' }
        };
      });

      const samples = [
        [
          'Fresh Milk',
          'Amul',
          'Dairy & Milk Products',
          4.5,
          5,
          'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&q=80&w=600',
          'Fresh cow milk',
          '500ml',
          35,
          30,
          100
        ],
        [
          'Organic Bananas',
          'DailyMart Choice',
          'Fruits & Vegetables',
          4.8,
          0,
          'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&q=80&w=600',
          'Fresh organic bananas',
          '1kg',
          80,
          69.99,
          50
        ],
        [
          'Dishwash Liquid',
          'Pril',
          'Kitchen Essentials',
          4.2,
          18,
          'https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&q=80&w=600',
          'Concentrated lime dishwash liquid',
          '250ml',
          45,
          40,
          120
        ]
      ];

      samples.forEach(row => worksheet.addRow(row));

      worksheet.columns.forEach(column => {
        let maxLen = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const valLen = cell.value ? String(cell.value).length : 0;
          if (valLen > maxLen) maxLen = valLen;
        });
        column.width = Math.min(Math.max(maxLen + 4, 12), 40);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'DailyMart_Product_Import_Template.xlsx';
      link.click();
    } catch (err) {
      alert('Failed to generate template: ' + err.message);
    }
  };

  const downloadErrorReport = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Import Error Report');

      const headers = [
        'Product Name',
        'Brand Name',
        'Category',
        'Catalog Display Rating',
        'GST Rate',
        'Product Image URL',
        'Product Description',
        'Pack Size',
        'Original Price',
        'Selling Price',
        'Stock Quantity',
        'Error Reason',
        'Duplicate Reason'
      ];

      worksheet.addRow(headers);
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE11D48' }
        };
      });

      const reportRows = [];

      summaryData.failedRows.forEach(item => {
        reportRows.push({
          rowIndex: item.rowIndex,
          row: item.row,
          errors: item.errors,
          reason: item.errors.map(e => `${e.column}: ${e.error}`).join('; '),
          isDuplicate: false
        });
      });

      summaryData.duplicateRows.forEach(item => {
        reportRows.push({
          rowIndex: item.rowIndex,
          row: item.row,
          errors: [],
          reason: '',
          duplicateReason: item.reason,
          isDuplicate: true
        });
      });

      reportRows.sort((a, b) => a.rowIndex - b.rowIndex);

      reportRows.forEach((rObj) => {
        const rowData = [
          rObj.row['Product Name'] || '',
          rObj.row['Brand Name'] || '',
          rObj.row['Category'] || '',
          rObj.row['Catalog Display Rating'] || '',
          rObj.row['GST Rate'] || '',
          rObj.row['Product Image URL'] || '',
          rObj.row['Product Description'] || '',
          rObj.row['Pack Size'] || '',
          rObj.row['Original Price'] || '',
          rObj.row['Selling Price'] || '',
          rObj.row['Stock Quantity'] || '',
          rObj.reason || '',
          rObj.duplicateReason || ''
        ];

        worksheet.addRow(rowData);
        const lastRow = worksheet.lastRow;

        const redFill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFE4E6' }
        };

        if (rObj.isDuplicate) {
          const dupFill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFBEB' }
          };
          for (let i = 1; i <= 11; i++) {
            lastRow.getCell(i).fill = dupFill;
          }
          const dupReasonCell = lastRow.getCell(13);
          dupReasonCell.font = { color: { argb: 'FFD97706' }, bold: true };
        } else {
          rObj.errors.forEach(err => {
            const colIdx = headers.indexOf(err.column) + 1;
            if (colIdx > 0) {
              lastRow.getCell(colIdx).fill = redFill;
              lastRow.getCell(colIdx).border = {
                top: { style: 'thin', color: { argb: 'FFF43F5E' } },
                left: { style: 'thin', color: { argb: 'FFF43F5E' } },
                bottom: { style: 'thin', color: { argb: 'FFF43F5E' } },
                right: { style: 'thin', color: { argb: 'FFF43F5E' } }
              };
            }
          });
          const errorReasonCell = lastRow.getCell(12);
          errorReasonCell.font = { color: { argb: 'FFE11D48' }, bold: true };
        }
      });

      worksheet.columns.forEach(column => {
        let maxLen = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const valLen = cell.value ? String(cell.value).length : 0;
          if (valLen > maxLen) maxLen = valLen;
        });
        column.width = Math.min(Math.max(maxLen + 4, 12), 40);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'Import_Error_Report.xlsx';
      link.click();
    } catch (err) {
      alert('Failed to generate error report: ' + err.message);
    }
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [rating, setRating] = useState(0); 
  const [gst, setGst] = useState(0);

  const [showGstDropdown, setShowGstDropdown] = useState(false);
  const gstDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (gstDropdownRef.current && !gstDropdownRef.current.contains(event.target)) {
        setShowGstDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [variantName, setVariantName] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const [variantOriginalPrice, setVariantOriginalPrice] = useState('');
  const [variantStock, setVariantStock] = useState('');
  const [variantsList, setVariantsList] = useState([]);

  const [isEditingVariant, setIsEditingVariant] = useState(false);
  const [editingVariantIndex, setEditingVariantIndex] = useState(null);

  const fetchInventoryGrid = async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) setLoading(true);
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
        params: {
          page,
          limit: 10,
          tab,
          search,
          sort
        }
      };
      const { data } = await axios.get('/api/admin/products', config);
      setProducts(data.products || []);
      setPages(data.pages || 1);
      setTotalFilteredProducts(data.totalFilteredProducts || 0);
      setAllCount(data.allCount || 0);
      setManualCount(data.manualCount || 0);
      setBulkCount(data.bulkCount || 0);
      if (showLoadingSpinner) setLoading(false);
    } catch (err) {
      if (showLoadingSpinner) setLoading(false);
      if (showLoadingSpinner) {
        alert(err.response?.data?.message || err.message);
      } else {
        console.error(err);
      }
    }
  };

  const fetchAllProductsUnpaginated = async () => {
    try {
      const { data } = await axios.get('/api/products');
      setAllProductsUnpaginated(data);
    } catch (err) {
      console.error('Failed to fetch unpaginated products:', err);
    }
  };

  useEffect(() => {
    const initialInputs = {};
    allProductsUnpaginated.forEach(p => {
      initialInputs[p._id] = p.image || '';
    });
    setImageInputs(initialInputs);
  }, [allProductsUnpaginated]);

  useEffect(() => {
    if (searchInput === search) return;
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  useEffect(() => {
    let interval;
    if (userInfo) {
      fetchInventoryGrid(true);
      fetchAllProductsUnpaginated();
      interval = setInterval(() => {
        fetchInventoryGrid(false);
        fetchAllProductsUnpaginated();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [userInfo, page, tab, search, sort]);


  const addVariantToStaging = () => {
    if (!variantName || variantPrice === '') {
      return alert('Please enter pack size and selling price.');
    }

    const sPrice = Number(variantPrice);
    const oPrice = variantOriginalPrice !== '' ? Number(variantOriginalPrice) : sPrice;

    if (oPrice < sPrice) {
      return alert('⚠️ Pricing Boundary Alert: Original Price must be greater than or equal to the Selling Price.');
    }

    const compiledVariant = {
      name: variantName,
      price: sPrice,
      originalPrice: oPrice,
      countInStock: Number(variantStock || 0),
    };

    if (isEditingVariant) {
      const updatedList = [...variantsList];
      updatedList[editingVariantIndex] = compiledVariant;
      setVariantsList(updatedList);
      setIsEditingVariant(false);
      setEditingVariantIndex(null);
    } else {
      setVariantsList([...variantsList, compiledVariant]);
    }

    setVariantName('');
    setVariantPrice('');
    setVariantOriginalPrice('');
    setVariantStock('');
  };

  const startEditVariantHandler = (index) => {
    const targetVariant = variantsList[index];
    setIsEditingVariant(true);
    setEditingVariantIndex(index);

    setVariantName(targetVariant.name);
    setVariantPrice(targetVariant.price);
    setVariantOriginalPrice(targetVariant.originalPrice === targetVariant.price ? '' : targetVariant.originalPrice);
    setVariantStock(targetVariant.countInStock || 0);
  };

  const cancelVariantEditHandler = () => {
    setIsEditingVariant(false);
    setEditingVariantIndex(null);
    setVariantName('');
    setVariantPrice('');
    setVariantOriginalPrice('');
    setVariantStock('');
  };

  const removeVariantFromStaging = (index) => {
    if (isEditingVariant && editingVariantIndex === index) {
      cancelVariantEditHandler();
    }
    setVariantsList(variantsList.filter((_, i) => i !== index));
  };

  const handleCategoryChange = (val) => {
    setCategory(val);
    const catLower = val.trim().toLowerCase();
    if (catLower === 'fruits & vegetables') {
      setGst(0);
    } else if (catLower === 'dairy & milk products' || catLower === 'kitchen essentials') {
      setGst(5);
    } else if (catLower === 'personal care products' || catLower === 'home essentials') {
      setGst(18);
    }
  };

  const startCreateHandler = () => {
    setIsEditing(true);
    setEditId(null);

    setName('');
    setBrand('');
    setCategory('');
    setDescription('');
    setImage('');
    setRating(0); 
    setGst(0);
    setVariantsList([]);
    cancelVariantEditHandler();
  };

  const startEditHandler = (product) => {
    setIsEditing(true);
    setEditId(product._id);

    setName(product.name);
    setBrand(product.brand);
    setCategory(product.category);
    setDescription(product.description || '');
    setImage(product.image);
    setRating(product.rating || 0); 
    setGst(product.gst || 0);
    setVariantsList(product.variants || []);
    cancelVariantEditHandler();
  };

  const saveProductFormHandler = async (e) => {
    e.preventDefault();

    const nameRegex = /^[a-zA-Z][a-zA-Z0-9\s'\-&\[\]\(\)\{\}]*$/;
    const categoryRegex = /^[a-zA-Z\s&]+$/;

    if (!name || name.trim() === '') {
      return alert('Product Name is required.');
    }
    if (!/^[a-zA-Z]/.test(name.trim())) {
      return alert('Product Name must start with an alphabet.');
    }
    if (!nameRegex.test(name.trim())) {
      return alert("Product Name contains invalid characters. Only letters, numbers, spaces, hyphens, ampersands, apostrophes, and brackets are allowed.");
    }

    if (!brand || brand.trim() === '') {
      return alert('Brand Name is required.');
    }
    if (!/^[a-zA-Z]/.test(brand.trim())) {
      return alert('Brand Name must start with an alphabet.');
    }
    if (!nameRegex.test(brand.trim())) {
      return alert("Brand Name contains invalid characters. Only letters, numbers, spaces, hyphens, ampersands, apostrophes, and brackets are allowed.");
    }

    if (!category || category.trim() === '') {
      return alert('Category is required.');
    }
    if (!categoryRegex.test(category.trim())) {
      return alert('Category must contain only alphabets, spaces, and ampersands.');
    }

    if (variantsList.length === 0) {
      return alert('Please add at least one pack size.');
    }

    const payload = {
      name: name.trim(),
      brand: brand.trim(),
      category: category.trim(),
      description: description || '',
      image: image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600',
      rating: Number(rating) || 0, 
      gst: Number(gst) || 0,
      variants: variantsList,
    };

    try {
      const config = {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.token}`,
        },
      };

      if (editId) {
        await axios.put(`/api/admin/products/${editId}`, payload, config);
        alert('Product updated successfully.');
      } else {
        await axios.post('/api/admin/products', payload, config);
        alert('Product added successfully.');
      }

      setIsEditing(false);
      setEditId(null);
      fetchInventoryGrid();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const deleteProductHandler = async (id) => {
    const isConfirmed = await showConfirm('Delete this product permanently?');
    if (!isConfirmed) return;

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
      };

      await axios.delete(`/api/admin/products/${id}`, config);
      fetchInventoryGrid();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleConvertCategory = async () => {
    if (!sourceCategory || sourceCategory.trim() === '') {
      return alert('Please select a source category.');
    }
    if (!targetCategory || targetCategory.trim() === '') {
      return alert('Please enter or select a target category.');
    }
    if (sourceCategory.trim().toLowerCase() === targetCategory.trim().toLowerCase()) {
      return alert('Source and target categories cannot be the same.');
    }

    const categoryRegex = /^[a-zA-Z\s&]+$/;
    if (!categoryRegex.test(targetCategory.trim())) {
      return alert('Category must contain only alphabets, spaces, and ampersands.');
    }

    const isConfirmed = await showConfirm(
      `Are you sure you want to convert all products in category "${sourceCategory}" to "${targetCategory}"?`
    );
    if (!isConfirmed) return;

    try {
      setLoading(true);
      const config = {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.token}`,
        },
      };

      const { data } = await axios.post(
        '/api/admin/products/convert-category',
        { sourceCategory: sourceCategory.trim(), targetCategory: targetCategory.trim() },
        config
      );

      alert(`🎉 Category converted! Modified ${data.modifiedCount} products.`);
      setSourceCategory('');
      setTargetCategory('');
      
      // Dispatch custom event to sync headers/navbar instantly
      window.dispatchEvent(new CustomEvent('productsUpdated'));

      fetchAllProductsUnpaginated();
      fetchInventoryGrid();
    } catch (err) {
      setLoading(false);
      alert(err.response?.data?.message || err.message);
    }
  };

  const updateImageHandler = async (productId) => {
    const rawImageUrl = imageInputs[productId];
    if (!rawImageUrl || rawImageUrl.trim() === '') {
      return alert('Image URL cannot be empty.');
    }

    const imageUrl = extractRealImageUrl(rawImageUrl.trim());

    try {
      const config = {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.token}`,
        },
      };

      // Update the local state immediately for verification without page refresh
      setAllProductsUnpaginated(prev =>
        prev.map(prod => prod._id === productId ? { ...prod, image: imageUrl } : prod)
      );

      setProducts(prev =>
        prev.map(prod => prod._id === productId ? { ...prod, image: imageUrl } : prod)
      );

      // Clean the text input field itself to display the clean extracted URL
      setImageInputs(prev => ({ ...prev, [productId]: imageUrl }));

      await axios.put(`/api/admin/products/${productId}/image`, { image: imageUrl }, config);
      alert('Product image updated successfully.');

      // Dispatch custom event to sync headers/navbar instantly
      window.dispatchEvent(new CustomEvent('productsUpdated'));

      fetchAllProductsUnpaginated();
      fetchInventoryGrid();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
      fetchAllProductsUnpaginated();
      fetchInventoryGrid();
    }
  };




  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const escapeCSVCell = (val) => {
    if (val === undefined || val === null) return '';
    let str = String(val);
    // Escape double quotes by doubling them
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      str = '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const exportStoreProductsCSV = async () => {
    const isConfirmed = await showConfirm('Are you sure you want to export all products in store as a CSV file?');
    if (!isConfirmed) return;

    try {
      setLoading(true);
      const { data: allProducts } = await axios.get('/api/products');
      
      const headers = [
        'Product Name',
        'Brand Name',
        'Category',
        'Catalog Display Rating',
        'GST Rate',
        'Product Image URL',
        'Product Description',
        'Pack Size',
        'Original Price',
        'Selling Price',
        'Stock Quantity'
      ];

      const csvRows = [headers.join(',')];

      allProducts.forEach(p => {
        const pName = p.name || '';
        const brand = p.brand || '';
        const category = p.category || '';
        const rating = p.rating !== undefined ? p.rating : 0;
        const gst = p.gst !== undefined ? p.gst : 0;
        const imageUrl = p.image || '';
        const desc = p.description || '';

        if (p.variants && p.variants.length > 0) {
          p.variants.forEach(v => {
            const row = [
              escapeCSVCell(pName),
              escapeCSVCell(brand),
              escapeCSVCell(category),
              rating,
              gst,
              escapeCSVCell(imageUrl),
              escapeCSVCell(desc),
              escapeCSVCell(v.name || ''),
              v.originalPrice !== undefined ? v.originalPrice : v.price,
              v.price || 0,
              v.countInStock || 0
            ];
            csvRows.push(row.join(','));
          });
        } else {
          const row = [
            escapeCSVCell(pName),
            escapeCSVCell(brand),
            escapeCSVCell(category),
            rating,
            gst,
            escapeCSVCell(imageUrl),
            escapeCSVCell(desc),
            '',
            0,
            0,
            0
          ];
          csvRows.push(row.join(','));
        }
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `DailyMart_Products_Export_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      setLoading(false);
    } catch (err) {
      setLoading(false);
      alert('Failed to export products: ' + err.message);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto py-6 font-sans text-gray-800">

      <style>{`
        @keyframes containerReveal {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-form-reveal {
          animation: containerReveal 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-gray-200 pb-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight">Store Products</h1>
          <p className="text-xs text-gray-600 font-semibold mt-0.5">Add and manage products, prices, offers, and stock.</p>
        </div>

        {!isEditing && (
          <div className="flex flex-wrap gap-2 items-center">
            {/* Download Sample Template */}
            <button
              type="button"
              onClick={downloadSampleTemplate}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg shadow-3xs transition-colors cursor-pointer"
            >
              📥 Sample Template
            </button>

            {/* Export Store Products */}
            <button
              type="button"
              onClick={exportStoreProductsCSV}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg shadow-3xs transition-colors cursor-pointer"
            >
              📤 Export CSV
            </button>

            {/* Upload Products (Trigger file input) */}
            <label className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95">
              📤 Upload Products
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
              />
            </label>

            <button
              type="button"
              onClick={startCreateHandler}
              className="bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg shadow-xs transition-colors active:scale-95 cursor-pointer"
            >
              + Add Product
            </button>
          </div>
        )}
      </div>

      {/* Upload Progress Bar */}
      {isUploading && (
        <div className="w-full bg-white border border-gray-250 rounded-xl p-4 mt-4 shadow-sm animate-pulse">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider mb-2 text-gray-700">
            <span>Uploading and Processing Products...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-600 h-full transition-all duration-300 rounded-full" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {isEditing && (
        <form
          onSubmit={saveProductFormHandler}
          className="bg-white border border-gray-300 p-6 rounded-xl mt-5 grid md:grid-cols-2 gap-6 shadow-xs animate-form-reveal"
        >
          {/* LEFT SECTION: MAIN DETAILS */}
          <div className="space-y-4">
            <h3 className="font-semibold text-xs uppercase tracking-wider border-b pb-1.5 text-emerald-700">Product Details</h3>

            <div>
              <label className="block text-[11px] text-gray-600 font-bold uppercase tracking-wide mb-1">Product Name</label>
              <input
                type="text"
                required
                placeholder="e.g., Fresh Milk"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 p-2 text-xs rounded bg-white text-gray-900 font-medium focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-600 font-bold uppercase tracking-wide mb-1">Brand Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Amul"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full border border-gray-300 p-2 text-xs rounded bg-white text-gray-900 font-medium focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-600 font-bold uppercase tracking-wide mb-1">Category</label>
                <input
                  type="text"
                  list="categoryList"
                  required
                  placeholder="Select Category"
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full border border-gray-300 p-2 text-xs rounded bg-white text-gray-900 font-medium focus:border-emerald-500 outline-none"
                />
                <datalist id="categoryList">
                  {uniqueCategories.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-600 font-bold uppercase tracking-wide mb-1">
                  Catalog Display Rating ({rating || 'Not Rated'} Stars)
                </label>
                <div className="flex items-center gap-4 bg-gray-50 border border-gray-300 rounded p-2 h-[38px]">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((starValue) => (
                      <button
                        key={starValue}
                        type="button"
                        onClick={() => setRating(starValue)}
                        className={`text-base focus:outline-none cursor-pointer transition-colors ${starValue <= rating ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <span className="text-gray-300">|</span>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    placeholder="0.0"
                    value={rating || ''}
                    onChange={(e) => {
                      let inputVal = Number(e.target.value);
                      if (inputVal > 5) inputVal = 5;
                      if (inputVal < 0) inputVal = 0;
                      setRating(inputVal);
                    }}
                    className="w-16 bg-white border border-gray-300 text-center text-xs font-bold rounded py-0.5 text-gray-900 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div ref={gstDropdownRef}>
                <label className="block text-[11px] text-gray-600 font-bold uppercase tracking-wide mb-1">
                  GST Rate (%)
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowGstDropdown(!showGstDropdown)}
                    className="w-full p-2 pr-8 text-xs text-left text-gray-700 border border-gray-300 rounded bg-white flex items-center justify-between cursor-pointer focus:border-emerald-500 transition-colors font-bold h-[36px] outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                  >
                    <span>{gst === 0 ? "0% (GST Free)" : `${gst}% GST`}</span>
                    <span className="text-[9px] text-gray-400 select-none">▼</span>
                  </button>

                  {showGstDropdown && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto custom-scrollbar border-t-2 border-t-emerald-600 overflow-hidden">
                      {[
                        { label: '0% (GST Free)', value: 0 },
                        { label: '5% GST', value: 5 },
                        { label: '18% GST', value: 18 },
                        { label: '28% GST', value: 28 },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setGst(option.value);
                            setShowGstDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-emerald-50 hover:text-emerald-700 block outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
                            gst === option.value
                              ? 'text-emerald-600 bg-emerald-50/50 font-black'
                              : 'text-gray-700 font-bold'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-gray-600 font-bold uppercase tracking-wide mb-1">Product Image URL</label>
              <input
                type="text"
                required
                placeholder="https://example.com/image.jpg"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                className="w-full border border-gray-300 p-2 text-xs rounded bg-white text-gray-800 font-mono focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] text-gray-600 font-bold uppercase tracking-wide mb-1">Product Description</label>
              <textarea
                placeholder="Write product details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows="4"
                className="w-full border border-gray-300 p-2 text-xs rounded bg-white text-gray-900 font-medium focus:border-emerald-500 outline-none resize-none"
              />
            </div>
          </div>

          {/* RIGHT SECTION: STAGING VARIANT FORMS CONTROLLERS */}
          <div className="bg-gray-50 border border-gray-300 p-4 rounded-xl space-y-4">
            <h3 className="text-xs font-bold text-center uppercase tracking-wider text-gray-900 border-b border-gray-200 pb-1.5">
              {isEditingVariant ? '📝 Modify Selected Pack Size' : 'Pack Sizes & Prices'}
            </h3>

            <div className={`bg-white border p-4 rounded-lg grid grid-cols-2 gap-3 shadow-xs transition-all ${isEditingVariant ? 'border-amber-400 bg-amber-50/10' : 'border-gray-200'}`}>
              <div className="col-span-2">
                <label className="block text-[11px] text-gray-600 font-bold uppercase tracking-wide mb-1">Pack Size</label>
                <input
                  list="variantList"
                  placeholder="e.g., 500ml, 1kg"
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  className="w-full border border-gray-300 p-2 text-xs rounded text-gray-900 font-medium outline-none focus:border-emerald-500 bg-white"
                />
                <datalist id="variantList">
                  <option value="500ml" />
                  <option value="1lt" />
                  <option value="1kg" />
                  <option value="250g" />
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] text-gray-600 font-bold uppercase tracking-wide mb-1">Original Price (₹)</label>
                <input
                  placeholder="Optional (Blank = Selling Price)"
                  type="number"
                  step="0.01"
                  value={variantOriginalPrice}
                  onChange={(e) => setVariantOriginalPrice(e.target.value)}
                  className="w-full border border-gray-300 p-2 text-xs rounded text-gray-900 font-semibold bg-red-50/30 outline-none focus:border-red-400"
                />
              </div>

              <div>
                <label className="block text-[11px] text-green-700 font-bold uppercase tracking-wide mb-1">Selling Price (₹)</label>
                <input
                  placeholder="Enter selling price"
                  type="number"
                  step="0.01"
                  value={variantPrice}
                  onChange={(e) => setVariantPrice(e.target.value)}
                  className="w-full border border-gray-300 p-2 text-xs rounded text-gray-900 font-bold bg-green-50/30 outline-none focus:border-green-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] text-gray-600 font-bold uppercase tracking-wide mb-1">Stock Quantity</label>
                <input
                  placeholder="e.g., 50"
                  type="number"
                  value={variantStock}
                  onChange={(e) => setVariantStock(e.target.value)}
                  className="w-full border border-gray-300 p-2 text-xs rounded text-gray-900 font-semibold outline-none focus:border-emerald-500 bg-white"
                />
              </div>

              <div className="col-span-2 flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={addVariantToStaging}
                  className={`flex-grow font-bold text-xs py-2 rounded transition-all active:scale-95 cursor-pointer text-white ${isEditingVariant ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gray-900 hover:bg-emerald-600'}`}
                >
                  {isEditingVariant ? '✓ Update Variant Spec' : '+ Add Pack Size'}
                </button>
                {isEditingVariant && (
                  <button
                    type="button"
                    onClick={cancelVariantEditHandler}
                    className="border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-bold text-xs px-3 rounded transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {variantsList.map((v, i) => {
                const hasDiscount = v.originalPrice && v.originalPrice > v.price;
                const percentage = hasDiscount ? Math.round(((v.originalPrice - v.price) / v.originalPrice) * 100) : 0;
                const isItemBeingEdited = isEditingVariant && editingVariantIndex === i;

                return (
                  <div
                    key={i}
                    className={`flex justify-between items-center p-2.5 text-xs rounded-lg border shadow-xs animate-form-reveal transition-all ${isItemBeingEdited ? 'border-amber-400 bg-amber-50/30 ring-1 ring-amber-400' : 'bg-white border-gray-200'}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-gray-900 font-bold">{v.name}</span>
                      <span className="text-gray-400">|</span>
                      {hasDiscount ? (
                        <>
                          <span className="text-gray-400 line-through">₹{v.originalPrice}</span>
                          <span className="text-green-700 font-bold">₹{v.price}</span>
                          <span className="bg-red-50 text-red-500 border border-red-100 text-[9px] px-1 rounded font-bold">{percentage}% OFF</span>
                        </>
                      ) : (
                        <span className="text-gray-900 font-semibold">₹{v.price}</span>
                      )}
                      <span className="text-gray-400 font-normal">({v.countInStock} In Stock)</span>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        type="button"
                        disabled={isItemBeingEdited}
                        onClick={() => startEditVariantHandler(i)}
                        className="text-emerald-600 hover:text-emerald-800 disabled:opacity-30 font-bold uppercase text-[10px] tracking-wider transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeVariantFromStaging(i)}
                        className="text-red-500 hover:text-red-700 font-bold uppercase text-[10px] tracking-wider transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-gray-200">
              <button
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider py-2.5 rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                💾 Save Product
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs uppercase tracking-wider py-2.5 rounded-lg transition-all active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {!isEditing && (
        <>
          {/* Responsive Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            {/* Card 1: All Products */}
            <div
              onClick={() => { setTab('all'); setPage(1); }}
              className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
                tab === 'all'
                  ? 'bg-emerald-50/65 border-emerald-300 text-emerald-900 ring-2 ring-emerald-500/10'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-gray-500">All Products</span>
                <span className="text-sm">📦</span>
              </div>
              <div className="text-xl font-black text-gray-900 mt-2">{allCount}</div>
              <div className="text-[10px] text-gray-500 mt-0.5 font-semibold">Total active inventory products</div>
            </div>

            {/* Card 2: Individual Products */}
            <div
              onClick={() => { setTab('manual'); setPage(1); }}
              className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
                tab === 'manual'
                  ? 'bg-indigo-50/65 border-indigo-300 text-indigo-900 ring-2 ring-indigo-500/10'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-gray-500">Individual Additions</span>
                <span className="text-sm">✍️</span>
              </div>
              <div className="text-xl font-black text-gray-900 mt-2">{manualCount}</div>
              <div className="text-[10px] text-gray-500 mt-0.5 font-semibold">Added manually via form</div>
            </div>

            {/* Card 3: Bulk Products */}
            <div
              onClick={() => { setTab('bulk'); setPage(1); }}
              className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
                tab === 'bulk'
                  ? 'bg-blue-50/65 border-blue-300 text-blue-900 ring-2 ring-blue-500/10'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-gray-500">Bulk Imports</span>
                <span className="text-sm">📊</span>
              </div>
              <div className="text-xl font-black text-gray-900 mt-2">{bulkCount}</div>
              <div className="text-[10px] text-gray-500 mt-0.5 font-semibold">Uploaded via Excel/CSV templates</div>
            </div>
          </div>

          {/* Responsive 5-Tab Filter Bar */}
          <div className="flex border-b border-gray-200 mt-6 overflow-x-auto scrollbar-none whitespace-nowrap gap-1">
            <button
              onClick={() => { setTab('all'); setPage(1); }}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                tab === 'all'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              All Products ({allCount})
            </button>
            <button
              onClick={() => { setTab('manual'); setPage(1); }}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                tab === 'manual'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Individual Products ({manualCount})
            </button>
            <button
              onClick={() => { setTab('bulk'); setPage(1); }}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                tab === 'bulk'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              CSV/Excel Products ({bulkCount})
            </button>
            <button
              onClick={() => { setTab('convert_cat'); setPage(1); }}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                tab === 'convert_cat'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Convert Category 🔄
            </button>
            <button
              onClick={() => { setTab('image_update'); setPage(1); }}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                tab === 'image_update'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Image URL Update 🖼️
            </button>
          </div>

          {tab === 'convert_cat' && (
            <div className="bg-white border border-gray-300 p-6 rounded-xl mt-6 shadow-xs animate-form-reveal max-w-xl mx-auto text-left">
              <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-700 border-b pb-2 mb-4">
                🔄 Bulk Category Conversion
              </h3>
              <p className="text-xs text-gray-600 font-semibold mb-6">
                Replace the category of all products in one category with another. If the old category has no products left, it will be deleted automatically.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] text-gray-600 font-bold uppercase tracking-wide mb-1">Source Category (From)</label>
                  <select
                    value={sourceCategory}
                    onChange={(e) => setSourceCategory(e.target.value)}
                    className="w-full border border-gray-300 p-2 text-xs rounded bg-white text-gray-900 font-semibold focus:border-emerald-500 outline-none h-[38px] cursor-pointer"
                  >
                    <option value="">-- Select Source Category --</option>
                    {activeCategoriesOnly.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-gray-600 font-bold uppercase tracking-wide mb-1">Target Category (To)</label>
                  <input
                    type="text"
                    list="targetCategoryList"
                    placeholder="Type new or select existing category"
                    value={targetCategory}
                    onChange={(e) => setTargetCategory(e.target.value)}
                    className="w-full border border-gray-300 p-2 text-xs rounded bg-white text-gray-900 font-semibold focus:border-emerald-500 outline-none h-[38px]"
                  />
                  <datalist id="targetCategoryList">
                    {activeCategoriesOnly.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <button
                  type="button"
                  onClick={handleConvertCategory}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider py-2.5 rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer mt-4"
                >
                  Execute Category Conversion
                </button>
              </div>
            </div>
          )}

          {tab !== 'convert_cat' && (
            <>
              {/* Search Bar and Custom Sorting Dropdown */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6">
                <form onSubmit={handleSearchSubmit} className="flex-grow max-w-lg flex gap-2">
                  <div className="relative flex-grow">
                    <input
                      type="text"
                      placeholder="Search by name, brand, category..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="w-full bg-white border border-gray-350 pl-9 pr-3 py-2 text-xs rounded-lg text-gray-900 font-medium focus:border-emerald-500 outline-none h-[38px]"
                    />
                    <span className="absolute left-3 top-2.5 text-gray-400 text-xs">🔍</span>
                  </div>
                  <button
                    type="submit"
                    className="bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-colors cursor-pointer active:scale-95 h-[38px] flex-shrink-0"
                  >
                    Search
                  </button>
                </form>

                {tab !== 'image_update' && (
                  <div className="flex items-center gap-2 self-end md:self-auto">
                    <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wider whitespace-nowrap">Sort By:</label>
                    <select
                      value={sort}
                      onChange={(e) => { setSort(e.target.value); setPage(1); }}
                      className="bg-white border border-gray-300 p-2 text-xs rounded-lg text-gray-900 font-semibold focus:border-emerald-500 outline-none h-[38px] cursor-pointer"
                    >
                      <option value="1">Latest Upload First</option>
                      <option value="2">Oldest Upload First</option>
                      <option value="3">Stock Low → High</option>
                      <option value="4">Stock High → Low</option>
                      <option value="5">Price Low → High</option>
                      <option value="6">Price High → Low</option>
                      <option value="7">Product Name (A → Z)</option>
                      <option value="8">Product Name (Z → A)</option>
                      <option value="9">Brand Name (A → Z)</option>
                      <option value="10">Brand Name (Z → A)</option>
                      <option value="11">Category Name (A → Z)</option>
                      <option value="12">Category Name (Z → A)</option>
                      <option value="13">Rating High → Low</option>
                      <option value="14">Rating Low → High</option>
                    </select>
                  </div>
                )}
              </div>

              {tab === 'image_update' ? (
                <div className="bg-white border border-gray-300 p-6 rounded-xl mt-6 shadow-xs animate-form-reveal space-y-4 text-left">
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-amber-700 border-b pb-2">
                    🖼️ Fast Image URL Updates
                  </h3>
                  <p className="text-[10px] sm:text-xs text-gray-500 sm:text-gray-600 font-semibold leading-relaxed mt-1">
                    <span className="hidden sm:inline">Enter or update the image URLs for products in 2-column horizontal rows. Empty or default placeholder images are automatically sorted to the top.</span>
                    <span className="inline sm:hidden">💡 Update URLs. Empty/placeholder images are sorted to the top.</span>
                  </p>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-1 mt-4 custom-scrollbar">
                    {imageUpdateProductsList.length === 0 ? (
                      <p className="text-center text-xs font-bold text-gray-500 py-6 col-span-full">No products found in store.</p>
                    ) : (
                      imageUpdateProductsList.map((p) => {
                        const isEmpty = isUrlEmpty(p.image);
                        return (
                          <div
                            key={p._id}
                            className={`p-2.5 sm:p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4 ${
                              isEmpty
                                ? 'bg-red-50/20 border-red-250 shadow-3xs'
                                : 'bg-white border-gray-200 hover:border-gray-350'
                            }`}
                          >
                            {/* Left part: Image & info */}
                            <div className="flex items-center justify-between sm:justify-start gap-3 min-w-0 sm:w-[40%]">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-250 bg-gray-50 flex-shrink-0 flex items-center justify-center">
                                  <img
                                    src={p.image}
                                    alt={p.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600';
                                    }}
                                  />
                                </div>
                                <div className="text-left min-w-0">
                                  <span className="block text-[9px] text-gray-400 font-extrabold uppercase tracking-wider leading-none mb-0.5">{p.brand}</span>
                                  <div className="flex items-center gap-1">
                                    <p className="font-bold text-gray-900 text-xs truncate max-w-[120px] sm:max-w-[160px]" title={p.name}>
                                      {p.name}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyText(p._id, `${p.brand} ${p.name}`)}
                                      className="text-gray-400 hover:text-emerald-600 transition-colors p-0.5 cursor-pointer flex-shrink-0"
                                      title="Copy Brand & Product Name"
                                    >
                                      {copiedId === p._id ? (
                                        <svg className="w-3 h-3 text-emerald-650" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                      ) : (
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
                                      )}
                                    </button>
                                    <a
                                      href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${p.brand} ${p.name}`)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-gray-400 hover:text-blue-600 transition-colors p-0.5 cursor-pointer flex-shrink-0 flex items-center"
                                      title="Search Images on Google"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                      </svg>
                                    </a>
                                  </div>
                                  {isEmpty && (
                                    <span className="inline-block bg-red-100 text-red-750 text-[8px] font-black uppercase tracking-wider px-1 py-0.2 rounded mt-0.5 animate-pulse">
                                      ⚠️ Empty
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Mobile ONLY: Update button next to the info */}
                              <button
                                type="button"
                                onClick={() => updateImageHandler(p._id)}
                                className="sm:hidden bg-gray-900 hover:bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded transition-colors cursor-pointer"
                              >
                                Update
                              </button>
                            </div>

                            {/* Middle input URL: full width on mobile, flex-grow on desktop */}
                            <div className="flex-grow">
                              <input
                                type="text"
                                placeholder="https://example.com/image.jpg"
                                value={imageInputs[p._id] || ''}
                                onChange={(e) => setImageInputs({ ...imageInputs, [p._id]: e.target.value })}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    updateImageHandler(p._id);
                                  }
                                }}
                                className="w-full border border-gray-300 px-2 py-1 text-xs rounded bg-white text-gray-805 font-mono focus:border-emerald-500 outline-none h-[30px] sm:h-[36px]"
                              />
                            </div>

                            {/* Desktop ONLY: Update button at the end */}
                            <button
                              type="button"
                              onClick={() => updateImageHandler(p._id)}
                              className="hidden sm:block bg-gray-900 hover:bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg transition-colors cursor-pointer shadow-3xs"
                            >
                              Update URL
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {loading ? (
                    <p className="text-center text-xs font-bold text-gray-600 mt-12 animate-pulse">Loading products...</p>
                  ) : (
                    <>
                      {products.length === 0 ? (
                        <div className="bg-white border border-gray-300 rounded-xl py-16 text-center text-gray-500 text-xs mt-6 font-semibold shadow-2xs">
                          📭 No products found matching your active filter criteria.
                        </div>
                      ) : (
                        <div>
                          <div className="border border-gray-300 rounded-xl overflow-hidden mt-6 bg-white shadow-sm hidden md:block">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs text-left border-collapse min-w-[900px]">
                                <thead>
                                  <tr className="bg-gray-100 border-b border-gray-300 text-gray-900 font-bold uppercase tracking-wider text-[11px]">
                                    <th className="p-4 w-20">ID</th>
                                    <th className="p-4">Brand & Product</th>
                                    <th className="p-4">Category</th>
                                    <th className="p-4">Upload Source</th>
                                    <th className="p-4">Price & Stock Details</th>
                                    <th className="p-4 text-center w-36">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 font-medium text-gray-800">
                                  {products.map((p) => (
                                    <tr key={p._id} className="hover:bg-emerald-50/40 transition-colors">
                                      <td className="p-4 font-mono text-gray-500 text-[11px] whitespace-nowrap">{p._id.slice(-6)}</td>
                                      <td className="p-4">
                                        <div className="flex items-center gap-3">
                                          <img src={p.image} alt={p.name} className="w-10 h-10 object-cover bg-gray-50 rounded-lg border border-gray-200 flex-shrink-0" />
                                          <div className="text-left min-w-0">
                                            <span className="block font-semibold text-[10px] text-emerald-600 uppercase tracking-wider mb-0.5">{p.brand}</span>
                                            <p className="font-bold text-gray-900 truncate max-w-[240px]" title={p.name}>{p.name}</p>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="p-4">
                                        <span className="bg-gray-50 border border-gray-200 text-gray-700 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide">
                                          {p.category}
                                        </span>
                                      </td>
                                      <td className="p-4">
                                        <span className={`border px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                          p.uploadSource === 'bulk'
                                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                                            : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                        }`}>
                                          {p.uploadSource === 'bulk' ? 'Bulk Import' : 'Manual'}
                                        </span>
                                      </td>
                                      <td className="p-4">
                                        <div className="text-left leading-normal">
                                          {p.variants && p.variants.length > 0 ? (
                                            <>
                                              <span className="font-black text-gray-900 text-xs">
                                                ₹{p.variants[0].price}
                                              </span>
                                              {p.variants.length > 1 && (
                                                <span className="text-[10px] text-gray-500 font-bold ml-1">
                                                  ({p.variants.length} options)
                                                </span>
                                              )}
                                              <div className="text-[10px] text-gray-500 font-semibold mt-0.5">
                                                Stock: {p.variants.reduce((acc, v) => acc + (v.countInStock || 0), 0)} units
                                              </div>
                                            </>
                                          ) : (
                                            <span className="text-red-500 font-bold text-[10px]">No variants</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="p-4 text-center">
                                        <div className="flex justify-center items-center gap-3">
                                          <button
                                            type="button"
                                            onClick={() => startEditHandler(p)}
                                            className="text-emerald-700 hover:text-emerald-900 font-black uppercase tracking-wider text-[10px] cursor-pointer"
                                          >
                                            Edit
                                          </button>
                                          <span className="text-gray-300 font-normal">|</span>
                                          <button
                                            type="button"
                                            onClick={() => deleteProductHandler(p._id)}
                                            className="text-red-650 hover:text-red-800 font-black uppercase tracking-wider text-[10px] cursor-pointer"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="block md:hidden mt-6 space-y-4">
                            {products.map((p) => {
                              const totalStock = p.variants ? p.variants.reduce((acc, v) => acc + (v.countInStock || 0), 0) : 0;
                              return (
                                <div 
                                  key={p._id}
                                  className="bg-white border border-gray-300 rounded-xl p-3 flex items-center gap-3 shadow-xs hover:shadow-md transition-shadow text-left"
                                >
                                  {/* Thumbnail */}
                                  <img 
                                    src={p.image} 
                                    alt={p.name} 
                                    className="w-14 h-14 rounded-lg object-cover border border-gray-200 bg-gray-50 flex-shrink-0"
                                  />

                                  {/* Info (grow) */}
                                  <div className="flex-grow min-w-0 space-y-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[8px] text-emerald-600 font-extrabold uppercase tracking-wider leading-none">{p.brand}</span>
                                      <span className={`border px-1 py-0.2 rounded text-[7px] font-black uppercase tracking-wider leading-none ${
                                        p.uploadSource === 'bulk'
                                          ? 'bg-blue-50 border-blue-150 text-blue-700'
                                          : 'bg-indigo-50 border-indigo-150 text-indigo-700'
                                      }`}>
                                        {p.uploadSource === 'bulk' ? 'Bulk' : 'Manual'}
                                      </span>
                                      <span className="bg-gray-50 border border-gray-200 text-gray-550 px-1 py-0.2 rounded text-[7px] font-bold uppercase tracking-wider leading-none truncate max-w-[80px]">
                                        {p.category}
                                      </span>
                                    </div>
                                    <h4 className="font-bold text-gray-900 text-xs truncate leading-snug" title={p.name}>{p.name}</h4>
                                    
                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-semibold">
                                      {p.variants && p.variants.length > 0 ? (
                                        <span className="font-extrabold text-gray-905">
                                          ₹{p.variants[0].price}
                                        </span>
                                      ) : (
                                        <span className="text-red-500 font-bold text-[8px]">No price</span>
                                      )}
                                      <span className="text-gray-300">|</span>
                                      <span>{totalStock} in stock</span>
                                    </div>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex flex-col gap-1.5 flex-shrink-0 min-w-[55px]">
                                    <button
                                      type="button"
                                      onClick={() => startEditHandler(p)}
                                      className="border border-gray-300 hover:bg-gray-50 text-emerald-700 font-bold px-2 py-1 rounded-lg text-[9px] uppercase tracking-wider text-center cursor-pointer active:scale-95 transition-all"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteProductHandler(p._id)}
                                      className="border border-red-150 bg-red-50/10 hover:bg-red-50 text-red-650 font-bold px-2 py-1 rounded-lg text-[9px] uppercase tracking-wider text-center cursor-pointer active:scale-95 transition-all"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Responsive Pagination Footer */}
                      {pages > 1 && (
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 border-t border-gray-200 pt-4 pb-2">
                          <span className="text-xs text-gray-500 font-medium">
                            Showing page <strong className="text-gray-900">{page}</strong> of <strong className="text-gray-900">{pages}</strong> ({totalFilteredProducts} matching products)
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={page === 1}
                              onClick={() => setPage(p => Math.max(p - 1, 1))}
                              className="border border-gray-350 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white text-gray-700 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              ◀ Prev
                            </button>
                            
                            {Array.from({ length: pages }, (_, i) => i + 1)
                              .filter(p => p === 1 || p === pages || Math.abs(p - page) <= 1)
                              .map((p, idx, arr) => (
                                <React.Fragment key={p}>
                                  {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-gray-400 text-xs px-1">...</span>}
                                  <button
                                    type="button"
                                    onClick={() => setPage(p)}
                                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                                      page === p
                                        ? 'bg-emerald-600 text-white'
                                        : 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700'
                                    }`}
                                  >
                                    {p}
                                  </button>
                                </React.Fragment>
                              ))}

                            <button
                              type="button"
                              disabled={page === pages}
                              onClick={() => setPage(p => Math.min(p + 1, pages))}
                              className="border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white text-gray-700 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              Next ▶
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
      {/* Validation Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4" style={{ zIndex: 9999999 }}>
          <div className="bg-white rounded-2xl border-t-4 border-t-emerald-600 border border-gray-250 p-6 shadow-2xl space-y-5 relative w-full max-w-md animate-fadeIn text-left">
            <div className="flex justify-between items-center border-b pb-2.5">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                {summaryData.failedCount > 0 ? (
                  <span className="text-red-600">⚠️ Import Completed With Errors</span>
                ) : (
                  <span className="text-emerald-700">🎉 Upload Completed</span>
                )}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowSummaryModal(false)}
                className="text-gray-400 hover:text-gray-700 font-bold text-xs uppercase cursor-pointer"
              >
                Close ×
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-gray-750 font-bold">
              <p className="text-gray-600">Here is the summary of your bulk product catalog import:</p>
              
              <div className="grid grid-cols-2 gap-3.5 pt-2">
                <div className="bg-gray-50 border border-gray-150 p-3 rounded-xl flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Total Rows</span>
                  <span className="text-lg font-black text-gray-900 mt-1">{summaryData.totalRows}</span>
                </div>
                <div className="bg-emerald-50/50 border border-emerald-150 p-3 rounded-xl flex flex-col">
                  <span className="text-[10px] text-emerald-600 uppercase font-bold tracking-wider">Successfully Imported</span>
                  <span className="text-lg font-black text-emerald-700 mt-1">{summaryData.importedCount}</span>
                </div>
                <div className="bg-amber-50/50 border border-amber-150 p-3 rounded-xl flex flex-col">
                  <span className="text-[10px] text-amber-600 uppercase font-bold tracking-wider">Stock Counts Updated</span>
                  <span className="text-lg font-black text-amber-700 mt-1">{summaryData.updatedCount || 0}</span>
                </div>
                <div className="bg-red-50/50 border border-red-150 p-3 rounded-xl flex flex-col">
                  <span className="text-[10px] text-red-500 uppercase font-bold tracking-wider">Failed Rows Skipped</span>
                  <span className="text-lg font-black text-red-600 mt-1">{summaryData.failedCount}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-150 flex gap-3 justify-end">
              {(summaryData.failedCount > 0 || summaryData.duplicateCount > 0) && (
                <button
                  type="button"
                  onClick={downloadErrorReport}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  Download Error Report 📋
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-lg border border-gray-200 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProducts;