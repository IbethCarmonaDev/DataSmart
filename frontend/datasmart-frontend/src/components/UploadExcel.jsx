import React, { useState } from 'react';
import axios from 'axios';

const UploadExcel = () => {
    const [file, setFile] = useState(null);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) return;

        setLoading(true);
        const formData = new FormData();
        formData.append('ArchivoExcel', file);

        try {
            const response = await axios.post('https://localhost:44323/api/Finance/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setResult(response.data);
        } catch (error) {
            console.error('Error:', error);
            alert('Error subiendo el archivo');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mt-5">
            <h1>DataSmart Finance</h1>
            <p>Sube tu archivo Excel para generar el Estado de Resultados</p>
            
            <form onSubmit={handleSubmit}>
                <div className="mb-3">
                    <input 
                        type="file" 
                        accept=".xlsx,.xls" 
                        onChange={(e) => setFile(e.target.files[0])} 
                        className="form-control"
                    />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Procesando...' : 'Subir y Procesar'}
                </button>
            </form>

            {result && (
                <div className="mt-4">
                    <h2>Resultados</h2>
                    <p>Archivo: {result.fileName}</p>
                    <p>Movimientos: {result.totalMovimientos}</p>
                    <p>Clasificaciones: {result.totalClasificaciones}</p>
                    
                    <h3>Reporte Estado de Resultados</h3>
                    <pre>{JSON.stringify(result.reporte, null, 2)}</pre>
                </div>
            )}
        </div>
    );
};

// ¡ESTA LÍNEA ES CLAVE! Debe ser EXACTAMENTE así:
export default UploadExcel;